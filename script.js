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
      row.innerHTML = `<td><a href="details.html?id=${t.id}">${t.id}</a></td><td>$${t.amount}</td><td>${t.date}</td><td>${t.type}</td><td>${t.fraudScore}</td>`;
      tbody.appendChild(row);
    });
  }
  if (document.getElementById('alert-list')) {
    const alertList = document.getElementById('alert-list');
    alertList.innerHTML = '';
    flagged.forEach(t => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div><h4>Transaction ${t.id}</h4><p>Amount: $${t.amount}, Score: ${t.fraudScore}</p></div><span class="badge">Alert</span>`;
      item.innerHTML += `<a href="details.html?id=${t.id}" class="btn ripple">Investigate</a>`;
      alertList.appendChild(item);
    });
  }
  if (document.getElementById('resolved-count')) {
    const resolved = JSON.parse(localStorage.getItem('history') || '[]').filter(t => t.status === 'resolved').length;
    document.getElementById('resolved-count').textContent = resolved;
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
  } else if (page.includes('details.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const transId = parseInt(urlParams.get('id'));
    const trans = data.transactions.find(t => t.id === transId);
    if (trans) {
      document.getElementById('trans-id').textContent = trans.id;
      document.getElementById('trans-amount').textContent = trans.amount;
      document.getElementById('trans-date').textContent = trans.date;
      document.getElementById('trans-type').textContent = trans.type;
      document.getElementById('trans-fraud').textContent = trans.fraudScore;
      document.getElementById('trans-status').textContent = trans.status;
      const ctx = document.getElementById('trans-chart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.transactions.map(t => t.date),
          datasets: [{
            label: 'Amount',
            data: data.transactions.map(t => t.id === transId ? t.amount : null),
            borderColor: 'var(--accent)',
            backgroundColor: 'var(--gradient)',
            tension: 0.4,
            fill: false
          }]
        },
        options: { plugins: { tooltip: { enabled: true } } }
      });
      document.getElementById('mark-false').addEventListener('click', () => {
        trans.status = 'resolved';
        updateHistory(trans);
        alert('Marked as false positive');
      });
      document.getElementById('escalate').addEventListener('click', () => {
        trans.status = 'escalated';
        updateHistory(trans);
        alert('Escalated for review');
      });
    }
  } else if (page.includes('alerts.html')) {
    worker.postMessage(data.transactions);
    document.getElementById('alert-filter').addEventListener('submit', (e) => {
      e.preventDefault();
      const searchId = document.getElementById('search-id').value;
      const sortBy = document.getElementById('sort-severity').value;
      let flagged = JSON.parse(localStorage.getItem('flaggedTransactions') || '[]');
      if (searchId) flagged = flagged.filter(t => t.id == searchId);
      flagged.sort((a, b) => sortBy === 'fraudScore' ? b.fraudScore - a.fraudScore : new Date(b.date) - new Date(a.date));
      const alertList = document.getElementById('alert-list');
      alertList.innerHTML = '';
      flagged.forEach(t => {
        const item = document.createElement('div');
        item.className = 'alert-item';
        item.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div><h4>Transaction ${t.id}</h4><p>Amount: $${t.amount}, Score: ${t.fraudScore}</p></div><span class="badge">Alert</span>`;
        item.innerHTML += `<a href="details.html?id=${t.id}" class="btn ripple">Investigate</a>`;
        alertList.appendChild(item);
      });
    });
  } else if (page.includes('history.html')) {
    const history = JSON.parse(localStorage.getItem('history') || '[]');
    const itemsPerPage = 3;
    let currentPage = 1;
    function renderHistory(page) {
      const start = (page - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const tbody = document.getElementById('history-table').querySelector('tbody');
      tbody.innerHTML = '';
      history.slice(start, end).forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><a href="details.html?id=${t.id}">${t.id}</a></td><td>${t.date}</td><td>$${t.amount}</td><td>${t.status}</td>`;
        tbody.appendChild(row);
      });
      document.getElementById('prev-page').disabled = page === 1;
      document.getElementById('next-page').disabled = end >= history.length;
    }
    renderHistory(currentPage);
    document.getElementById('prev-page').addEventListener('click', () => {
      if (currentPage > 1) renderHistory(--currentPage);
    });
    document.getElementById('next-page').addEventListener('click', () => {
      if (currentPage * itemsPerPage < history.length) renderHistory(++currentPage);
    });
    document.getElementById('export-history').addEventListener('click', () => {
      const csv = ['ID,Date,Amount,Status', ...history.map(t => `${t.id},${t.date},${t.amount},${t.status}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fraud_history.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
    const ctx = document.getElementById('history-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.transactions.map(t => t.date),
        datasets: [{
          label: 'Fraud Score Trend',
          data: data.transactions.map(t => t.fraudScore),
          borderColor: 'var(--accent)',
          backgroundColor: 'var(--gradient)',
          tension: 0.4,
          fill: false
        }]
      },
      options: { plugins: { tooltip: { enabled: true } } }
    });
    const badges = document.getElementById('badges');
    const resolved = history.filter(t => t.status === 'resolved').length;
    if (resolved > 0) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.innerHTML = `<i class="fas fa-star"></i> ${resolved > 5 ? 'Fraud Master' : 'Fraud Fighter'}`;
      badges.appendChild(badge);
    }
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

  function updateHistory(trans) {
    const history = JSON.parse(localStorage.getItem('history') || '[]');
    const index = history.findIndex(t => t.id === trans.id);
    if (index >= 0) history[index] = trans;
    else history.push(trans);
    localStorage.setItem('history', JSON.stringify(history));
  }

  window.addEventListener('offline', () => alert('Offline mode activated - using cached data.'));
});