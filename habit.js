let habits = [
      { id: 1, name: "Exercise", desc: "30 min workout", completion: {} },
      { id: 2, name: "Drink Water", desc: "8 glasses daily", completion: {} },
      { id: 3, name: "Read", desc: "20 min reading", completion: {} }
    ];

    let currentWeekStart = new Date();
    let notificationSettings = {
      enabled: false,
      time: "09:00",
      habits: []
    };
    let analyticsChart = null;
    let deferredPrompt;
    
    // Set to Monday of the current week
    function getMonday(date) {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff));
    }

    function init() {
      currentWeekStart = getMonday(new Date());
      const savedHabits = localStorage.getItem("habits");
      if (savedHabits) habits = JSON.parse(savedHabits);
      
      const savedSettings = localStorage.getItem("notificationSettings");
      if (savedSettings) notificationSettings = JSON.parse(savedSettings);
      
      updateWeekDisplay();
      renderHabits();
      setupEventListeners();
      setupNotificationToggle();
      scheduleNotifications();
      registerServiceWorker();
    }

    function updateWeekDisplay() {
      const weekStart = new Date(currentWeekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const options = { month: 'short', day: 'numeric' };
      const weekRange = `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
      document.getElementById('week-range').textContent = weekRange;
    }

    function setupEventListeners() {
      document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        updateWeekDisplay();
        renderHabits();
      });

      document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        updateWeekDisplay();
        renderHabits();
      });

      // Add habit button
      document.getElementById('add-habit-btn').addEventListener('click', () => {
        openAddHabitModal();
      });

      // PWA installation
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('installBtn');
        installBtn.style.display = 'flex';
        
        installBtn.addEventListener('click', () => {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
            } else {
              console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
            installBtn.style.display = 'none';
          });
        });
      });
    }

    function registerServiceWorker() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
      }
    }

    function renderHabits() {
      const container = document.getElementById("habits-container");
      container.innerHTML = "";

      habits.forEach(habit => {
        const card = document.createElement("div");
        card.className = "habit-card p-4";
        card.onclick = () => showAnalytics(habit);

        // Progress
        const { done, total } = getProgress(habit);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        card.innerHTML = `
          <div class="flex justify-between items-center mb-3">
            <div>
              <h2 class="font-semibold text-lg text-gray-800">${habit.name}</h2>
              <p class="text-gray-500 text-sm">${habit.desc}</p>
            </div>
            <button onclick="event.stopPropagation(); deleteHabit(${habit.id})" class="delete-btn text-gray-400 hover:text-red-500">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="flex justify-between mb-3" id="days-${habit.id}"></div>
          <div class="mb-1">
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="progress-fill h-2" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <p class="text-xs text-gray-500">Weekly progress</p>
            <p class="text-xs font-semibold" style="color: #4f46e5;">${pct}% complete</p>
          </div>
        `;

        container.appendChild(card);
        renderDays(habit.id);
      });
      save();
    }

    function renderDays(habitId) {
      const habit = habits.find(h => h.id === habitId);
      const container = document.getElementById("days-" + habitId);
      container.innerHTML = "";

      const today = new Date();
      today.setHours(0,0,0,0);
      
      // Start from the current week's Monday
      const monday = new Date(currentWeekStart);
      monday.setHours(0,0,0,0);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        
        // Format date for display (e.g., "Aug 25")
        const dateDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        // Get day of week (e.g., "Mon")
        const dayDisplay = d.toLocaleDateString('en-US', { weekday: 'short' });

        let status = habit.completion[dateStr] || "incomplete";
        let icon = status === "completed" ? "check" : status === "rest" ? "bed" : "times";
        let color = status;

        const dayElement = document.createElement("div");
        dayElement.className = "day-container";
        
        dayElement.innerHTML = `
          <div class="text-xs text-gray-500 mb-1">${dayDisplay}</div>
          <button class="status-btn ${color}" data-date="${dateStr}">
            <i class="fas fa-${icon}"></i>
          </button>
          <div class="date-badge">${dateDisplay}</div>
        `;

        // Add click event to the button
        const button = dayElement.querySelector('button');
        button.onclick = (e) => {
          e.stopPropagation();
          toggleStatus(habitId, dateStr);
        };
        
        container.appendChild(dayElement);
      }
    }

    function toggleStatus(habitId, dateStr) {
      const habit = habits.find(h => h.id === habitId);
      const current = habit.completion[dateStr] || "incomplete";
      const next = current === "incomplete" ? "completed" : current === "completed" ? "rest" : "incomplete";
      habit.completion[dateStr] = next;
      renderHabits();
    }

    function getProgress(habit) {
      let done = 0, total = 0;
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0,0,0,0);
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        
        if (habit.completion[dateStr] !== "rest") {
          total++;
          if (habit.completion[dateStr] === "completed") done++;
        }
      }
      return { done, total };
    }

    function deleteHabit(id) {
      if (confirm("Are you sure you want to delete this habit?")) {
        habits = habits.filter(h => h.id !== id);
        renderHabits();
      }
    }

    function save() {
      localStorage.setItem("habits", JSON.stringify(habits));
    }

    // Add habit modal functions
    function openAddHabitModal() {
      document.getElementById('overlay').style.display = 'block';
      document.getElementById('add-habit-modal').style.display = 'block';
      document.getElementById('habit-name').value = '';
      document.getElementById('habit-desc').value = '';
    }

    function closeModal() {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('add-habit-modal').style.display = 'none';
    }

    function saveHabit() {
      const name = document.getElementById('habit-name').value.trim();
      if (!name) {
        alert('Please enter a habit name');
        return;
      }
      
      const desc = document.getElementById('habit-desc').value.trim();
      habits.push({ id: Date.now(), name, desc: desc || "", completion: {} });
      renderHabits();
      closeModal();
    }

    // Notification functions
    function openSettings() {
      document.getElementById('overlay').style.display = 'block';
      document.getElementById('notification-settings').style.display = 'block';
      populateHabitsSelection();
      updateNotificationUI();
    }

    function closeSettings() {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('notification-settings').style.display = 'none';
    }

    function setupNotificationToggle() {
      const toggle = document.getElementById('notification-toggle');
      const options = document.getElementById('notification-options');
      
      toggle.checked = notificationSettings.enabled;
      
      if (notificationSettings.enabled) {
        options.classList.remove('opacity-50', 'pointer-events-none');
      }
      
      toggle.addEventListener('change', function() {
        if (this.checked) {
          options.classList.remove('opacity-50', 'pointer-events-none');
          // Request notification permission
          if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
          }
        } else {
          options.classList.add('opacity-50', 'pointer-events-none');
        }
      });
    }

    function populateHabitsSelection() {
      const container = document.getElementById('habits-selection');
      container.innerHTML = '';
      
      habits.forEach(habit => {
        const isChecked = notificationSettings.habits.includes(habit.id);
        const div = document.createElement('div');
        div.className = 'flex items-center';
        div.innerHTML = `
          <input type="checkbox" id="habit-${habit.id}" value="${habit.id}" ${isChecked ? 'checked' : ''} class="mr-2">
          <label for="habit-${habit.id}">${habit.name}</label>
        `;
        container.appendChild(div);
      });
    }

    function updateNotificationUI() {
      document.getElementById('notification-time').value = notificationSettings.time;
    }

    function saveNotificationSettings() {
      notificationSettings.enabled = document.getElementById('notification-toggle').checked;
      notificationSettings.time = document.getElementById('notification-time').value;
      
      // Get selected habits
      notificationSettings.habits = [];
      habits.forEach(habit => {
        const checkbox = document.getElementById(`habit-${habit.id}`);
        if (checkbox && checkbox.checked) {
          notificationSettings.habits.push(habit.id);
        }
      });
      
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      closeSettings();
      scheduleNotifications();
      
      if (notificationSettings.enabled) {
        showNotification('Notification settings saved!', 'You will now receive reminders for your habits.');
      }
    }

    function scheduleNotifications() {
      // Clear any existing notifications
      if (window.habitNotificationInterval) {
        clearInterval(window.habitNotificationInterval);
      }
      
      if (notificationSettings.enabled && notificationSettings.habits.length > 0) {
        // Check if we need to send a notification now
        checkForNotification();
        
        // Set up interval to check every minute
        window.habitNotificationInterval = setInterval(checkForNotification, 60000);
      }
    }

    function checkForNotification() {
      const now = new Date();
      const [hours, minutes] = notificationSettings.time.split(':');
      const notificationTime = new Date();
      notificationTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // Check if it's the right time (within a minute window)
      const timeDiff = Math.abs(now - notificationTime);
      if (timeDiff < 60000) {
        // Check if we already notified today
        const lastNotification = localStorage.getItem('lastNotificationDate');
        const today = new Date().toDateString();
        
        if (lastNotification !== today) {
          sendDailyNotification();
          localStorage.setItem('lastNotificationDate', today);
        }
      }
    }

    function sendDailyNotification() {
      if (!("Notification" in window)) {
        return;
      }
      
      if (Notification.permission === "granted") {
        const habitNames = habits
          .filter(habit => notificationSettings.habits.includes(habit.id))
          .map(habit => habit.name)
          .join(', ');
        
        new Notification("🌱 Habit Tracker Reminder", {
          body: `Don't forget to: ${habitNames || 'complete your habits'} today!`,
          icon: 'https://example.com/icon.png' // You can add an icon URL here
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            sendDailyNotification();
          }
        });
      }
    }

    function showNotification(title, message) {
      if (!("Notification" in window)) {
        alert(message);
        return;
      }
      
      if (Notification.permission === "granted") {
        new Notification(title, { body: message });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification(title, { body: message });
          }
        });
      }
    }

    // Analytics functions
    function showAnalytics(habit) {
      document.getElementById('overlay').style.display = 'block';
      document.getElementById('analytics-panel').style.display = 'block';
      document.getElementById('analytics-title').textContent = `${habit.name} Analytics`;
      
      renderAnalyticsChart(habit);
    }

    function closeAnalytics() {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('analytics-panel').style.display = 'none';
      
      if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
      }
    }

    function renderAnalyticsChart(habit) {
      const ctx = document.getElementById('analytics-chart').getContext('2d');
      
      // Get data for the last 4 weeks
      const weeks = [];
      const completionData = [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() || 7) + 1 - (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Format week range for label
        const options = { month: 'short', day: 'numeric' };
        const weekLabel = `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
        weeks.push(weekLabel);
        
        // Calculate completion rate for this week
        let done = 0;
        let total = 0;
        
        for (let j = 0; j < 7; j++) {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + j);
          const dateStr = day.toISOString().split('T')[0];
          
          if (habit.completion[dateStr] !== "rest") {
            total++;
            if (habit.completion[dateStr] === "completed") done++;
          }
        }
        
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        completionData.push(completionRate);
      }
      
      if (analyticsChart) {
        analyticsChart.destroy();
      }
      
      // Custom plugin to display percentages on top of bars
      const customDataLabels = {
        id: 'customDataLabels',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          ctx.save();
          ctx.font = 'bold 12px Poppins';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#4f46e5';
          
          chart.data.datasets.forEach((dataset, i) => {
            chart.getDatasetMeta(i).data.forEach((bar, index) => {
              const value = chart.data.datasets[i].data[index];
              ctx.fillText(value + '%', bar.x, bar.y - 10);
            });
          });
          
          ctx.restore();
        }
      };
      
      analyticsChart = new Chart(ctx, {
        type: 'bar',
        plugins: [customDataLabels],
        data: {
          labels: weeks,
          datasets: [{
            label: 'Completion Rate (%)',
            data: completionData,
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value) {
                  return value + '%';
                }
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `Completion: ${context.raw}%`;
                }
              }
            }
          }
        }
      });
    }

    // Close modals when clicking outside
    document.getElementById('overlay').addEventListener('click', function() {
      closeSettings();
      closeAnalytics();
      closeModal();
    });

    window.onload = init;
