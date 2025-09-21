if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => console.log('SW registered')).catch(err => console.error('SW error', err));
}

const darkToggle = document.getElementById('dark-toggle');
if (darkToggle) {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark');
    darkToggle.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    document.body.classList.remove('dark');
    darkToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDarkNow = document.body.classList.contains('dark');
    darkToggle.innerHTML = isDarkNow ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    localStorage.setItem('darkMode', isDarkNow);
  });
}

async function fetchData() {
  return fetch('data.json').then(res => res.json()).catch(err => {
    console.error('Fetch error:', err);
    return { transactions: [], thresholds: { amount: 1000, fraudScore: 0.8 } };
  });
}

const worker = new Worker('worker.js');
worker.onmessage = (e) => {
  const flagged = e.data;
  localStorage.setItem('flaggedTransactions', JSON.stringify(flagged));
  if (document.getElementById('flagged-anomalies')) {
    document.getElementById('flagged-anomalies').textContent = flagged.length;
  }
  if (document.getElementById('fraud-table')) {
    const tbody = document.getElementById('fraud-table').querySelector('tbody');
    tbody.innerHTML = '';
    flagged.forEach(t => {
      const row = document.createElement('tr');
      row.className = 'fraud-row';
      row.innerHTML = `<td>${t.id}</td><td>$${t.amount}</td><td>${t.date}</td><td>${t.type}</td><td>${t.fraudScore}</td>`;
      tbody.appendChild(row);
    });
  }
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('ripple')) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    e.target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchData();
  const page = window.location.pathname;

  if (page.includes('index.html') || page === '/') {
    document.getElementById('total-trans').textContent = data.transactions.length;
    worker.postMessage(data.transactions);
  } else if (page.includes('dashboard.html')) {
    const form = document.getElementById('filter-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('date-range').value;
      const type = document.getElementById('trans-type').value;
      const filtered = data.transactions.filter(t => (!date || t.date === date) && (type === 'all' || t.type === type));
      worker.postMessage(filtered);
      updateCharts(filtered);
    });
    updateCharts(data.transactions);
  } else if (page.includes('reports.html')) {
    worker.postMessage(data.transactions);
    document.getElementById('export-csv').addEventListener('click', () => {
      const flagged = JSON.parse(localStorage.getItem('flaggedTransactions') || '[]');
      const csv = ['ID,Amount,Date,Type,Fraud Score', ...flagged.map(t => `${t.id},${t.amount},${t.date},${t.type},${t.fraudScore}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flagged_transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  } else if (page.includes('settings.html')) {
    document.getElementById('theme-toggle').addEventListener('click', () => darkToggle.click());
    document.getElementById('api-endpoint').addEventListener('change', (e) => console.log('Mock API set to:', e.target.value));
  }

  function updateCharts(transactions) {
    const trendCtx = document.getElementById('trend-chart')?.getContext('2d');
    const anomalyCtx = document.getElementById('anomaly-chart')?.getContext('2d');
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: transactions.map(t => t.date),
          datasets: [{
            label: 'Transaction Amounts',
            data: transactions.map(t => t.amount),
            borderColor: 'var(--accent)',
            backgroundColor: 'var(--gradient)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          animations: { tension: { duration: 1000, easing: 'easeOutBounce' } },
          plugins: { tooltip: { enabled: true } }
        }
      });
    }
    if (anomalyCtx) {
      new Chart(anomalyCtx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Transactions',
            data: transactions.map(t => ({ x: t.amount, y: t.fraudScore })),
            backgroundColor: transactions.map(t => t.fraudScore > data.thresholds.fraudScore || t.amount > data.thresholds.amount ? 'var(--alert)' : 'var(--accent)')
          }]
        },
        options: {
          scales: {
            x: { title: { display: true, text: 'Amount ($)' } },
            y: { title: { display: true, text: 'Fraud Score' } }
          },
          plugins: { tooltip: { callbacks: { label: ctx => `ID: ${transactions[ctx.dataIndex].id}, Amount: $${ctx.raw.x}, Score: ${ctx.raw.y}` } } }
        }
      });
    }
  }

  window.addEventListener('offline', () => alert('Offline mode activated - using cached data.'));
});