/* ============================================
   RAMBAUGCHI MATARANI 2026 - RAMBAUGCHI MATARANI VARGANI
   Shared API App Logic
   ============================================ */

const APP = {
  SOCIETY_NAME: 'RAMBAUGCHI MATARANI 2026',
  SOCIETY_SUBTITLE: 'Rambaugchi Matarani Vargani',
  TOTAL_FLOORS: 7,
  FLATS_PER_FLOOR: 24,
};

// ---- Authentication & Session Helpers ----
async function getAuth() {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    return data.loggedIn ? data : null;
  } catch (err) {
    console.error('Session check failed:', err);
    return null;
  }
}

async function requireAuth(role) {
  const auth = await getAuth();
  if (!auth || auth.role !== role) {
    window.location.href = '/';
    return null;
  }
  return auth;
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout failed:', err);
  }
  window.location.href = '/';
}

// ---- Backend API Fetching ----
async function getAllFlats() {
  const res = await fetch('/api/flats');
  if (!res.ok) throw new Error('Failed to load flats data');
  return await res.json();
}

async function getFlatsByFloor(floor) {
  const flats = await getAllFlats();
  return flats.filter(f => f.floor === floor);
}

async function getFlatById(flatNo) {
  const res = await fetch(`/api/flats/${flatNo}`);
  if (!res.ok) throw new Error('Failed to load flat details');
  return await res.json();
}

async function updateFlat(flatNo, updates) {
  const res = await fetch(`/api/flats/${flatNo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update flat on server');
  return await res.json();
}

async function getStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch statistics');
  return await res.json();
}

// ---- Toast Notifications ----
function showToast(message, type = 'info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Utilities ----
function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function renderBuildingOverview(container, flats) {
  container.innerHTML = '';
  flats.forEach(f => {
    const flatDiv = document.createElement('div');
    flatDiv.className = `flat-card ${f.isPaid ? 'paid' : 'pending'}`;
    
    let detailsHtml = '<div style="font-size: 0.8rem; margin-top: 8px;">Unpaid</div>';
    if (f.isPaid) {
      flatDiv.classList.add('paid');
      detailsHtml = `
        <div style="font-size: 0.8rem; margin-top: 8px;">
          <div>Paid: ${formatCurrency(f.amountPaid)}</div>
          <div>Date: ${formatDate(f.paymentDate)}</div>
        </div>
      `;
    }
    
    // Bhandara Badge
    let bhandaraHtml = '';
    if (f.bhandaraItems && f.bhandaraItems.trim() !== '') {
      bhandaraHtml = `
        <div style="font-size: 0.75rem; margin-top: 8px; background: var(--bg-secondary); padding: 4px 6px; border-radius: 4px; color: var(--accent-primary); border: 1px solid var(--accent-primary-light);">
          🌾 <strong>Bhandara:</strong> ${f.bhandaraItems}
        </div>
      `;
    }

    flatDiv.innerHTML = `
      <div class="flat-number">Flat ${f.flatNo}</div>
      <div class="owner-name">${f.ownerName || '<em>Unoccupied</em>'}</div>
      ${detailsHtml}
      ${bhandaraHtml}
    `;
    container.appendChild(flatDiv);
  });
}
