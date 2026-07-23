/* ============================================
   RAMBAUGCHI MATARANI 2026 - ADMIN PANEL (AJAX)
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('img[src^="/static/images/logo.png"]').forEach(img => {
    img.src = '/static/images/logo.png?t=' + new Date().getTime();
  });

  const auth = await requireAuth('admin');
  if (!auth) return;

  let currentFloor = 'all'; // 'all' = all floors
  let editingFlat = null;
  let allFlatsCache = []; // Cache to allow fast in-memory searching

  // Mobile sidebar toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('show');
    });
  }

  // ---- DOM Elements ----
  const statsGrid = document.getElementById('statsGrid');
  const buildingContainer = document.getElementById('buildingContainer');
  const floorTabsContainer = document.getElementById('floorTabs');
  const searchInput = document.getElementById('searchInput');
  const editModal = document.getElementById('editModal');

  // ---- Initialize ----
  await refreshData();
  renderFloorTabs();
  setupEventListeners();

  // ---- Load/Refresh Data ----
  async function refreshData() {
    try {
      allFlatsCache = await getAllFlats();
      await renderStats();
      renderBuilding();
      renderBhandara();
    } catch (err) {
      console.error('Error refreshing data:', err);
      showToast('Error refreshing data from server', 'error');
    }
  }

  // ---- Render Stats ----
  async function renderStats() {
    try {
      const stats = await getStats();
      statsGrid.innerHTML = `
        <div class="stat-card total">
          <div class="stat-icon">🏢</div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Flats</div>
        </div>
        <div class="stat-card paid">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.paid}</div>
          <div class="stat-label">Paid</div>
        </div>
        <div class="stat-card unpaid">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${stats.unpaid}</div>
          <div class="stat-label">Unpaid</div>
        </div>
        <div class="stat-card amount">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${formatCurrency(stats.totalAmount)}</div>
          <div class="stat-label">Total Collected</div>
        </div>
      `;
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  // ---- Render Floor Tabs ----
  function renderFloorTabs() {
    let tabs = `<button class="floor-tab ${currentFloor === 'all' ? 'active' : ''}" data-floor="all">All Floors</button>`;
    tabs += `<button class="floor-tab ${currentFloor === 0 ? 'active' : ''}" data-floor="0">Ground Floor</button>`;
    for (let i = 1; i <= APP.TOTAL_FLOORS; i++) {
      tabs += `<button class="floor-tab ${currentFloor === i ? 'active' : ''}" data-floor="${i}">Floor ${i}</button>`;
    }
    floorTabsContainer.innerHTML = tabs;
  }

  // ---- Render Building ----
  function renderBuilding(flatsData = null) {
    let html = '';
    const legend = `
      <div class="legend">
        <div class="legend-item"><span class="legend-dot paid"></span> Paid</div>
        <div class="legend-item"><span class="legend-dot unpaid"></span> Unpaid</div>
      </div>
    `;
    html += legend;

    const sourceData = flatsData || allFlatsCache;
    const floors = currentFloor === 'all'
      ? Array.from({ length: APP.TOTAL_FLOORS + 1 }, (_, i) => i).reverse()
      : [currentFloor];

    floors.forEach(floor => {
      const flats = sourceData.filter(f => f.floor === floor);
      if (flats.length === 0 && flatsData) return; // Hide empty search results floor sections

      html += `
        <div class="floor-section">
          <div class="floor-label">
            <span>🏗️</span> ${floor === 0 ? 'Ground Floor' : `Floor <span class="floor-num">${floor}</span>`}
            <span style="margin-left:auto; font-size:0.8rem; font-weight:400; color:var(--text-muted);">
              ${flats.filter(f => f.isPaid).length}/${flats.length} Paid
            </span>
          </div>
          <div class="flats-grid">
            ${flats.map(flat => `
              <div class="flat-card ${flat.isPaid ? 'paid' : 'unpaid'}" data-flat="${flat.flatNo}" title="Click to edit">
                <div class="flat-number">${flat.flatNo}</div>
                <div class="flat-owner">${flat.ownerName || '—'}</div>
                <div class="flat-status">${flat.isPaid ? '● Paid' : '○ Unpaid'}</div>
                ${flat.bhandaraItems ? `<div style="font-size:0.75rem; color:var(--accent-primary); margin-top:4px;">🌾 ${flat.bhandaraItems}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    if (sourceData.length === 0) {
      html += `<div style="text-align:center; padding:40px; color:var(--text-muted);">No flats found matching your search.</div>`;
    }

    buildingContainer.innerHTML = html;
  }

  // ---- Render Bhandara Donations ----
  function renderBhandara() {
    const container = document.getElementById('bhandaraContainer');
    if (!container) return;
    
    const donations = allFlatsCache.filter(f => f.bhandaraItems && f.bhandaraItems.trim() !== '');

    if (donations.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-color);">No bhandara donations recorded yet.</div>`;
      return;
    }

    container.innerHTML = donations.map(flat => `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">Flat ${flat.flatNo}</div>
          <div style="font-size:0.9rem; color:var(--text-secondary);">${flat.ownerName || 'Unknown Owner'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.85rem; color:var(--text-muted);">Donated Items</div>
          <div style="font-size:1rem; font-weight:500; color:var(--accent-primary);">🌾 ${flat.bhandaraItems}</div>
        </div>
      </div>
    `).join('');
  }

  // ---- Edit Modal ----
  async function openEditModal(flatNo) {
    try {
      const flat = await getFlatById(flatNo);
      editingFlat = flat;

      document.getElementById('editFlatNo').textContent = flat.flatNo;
      document.getElementById('editFloor').textContent = flat.floor === 0 ? 'Ground Floor' : `Floor ${flat.floor}`;
      document.getElementById('editOwnerName').value = flat.ownerName || '';
      document.getElementById('editAmount').value = flat.amountPaid || '';
      document.getElementById('editPaymentDate').value = flat.paymentDate || '';
      document.getElementById('editReceivedBy').value = flat.receivedBy || '';
      document.getElementById('editBhandara').value = flat.bhandaraItems || '';

      const paidBtn = document.getElementById('statusPaid');
      const unpaidBtn = document.getElementById('statusUnpaid');
      if (flat.isPaid) {
        paidBtn.classList.add('active');
        unpaidBtn.classList.remove('active');
      } else {
        unpaidBtn.classList.add('active');
        paidBtn.classList.remove('active');
      }

      togglePaymentFields(flat.isPaid);
      editModal.classList.add('show');
    } catch (err) {
      console.error('Error opening edit modal:', err);
      showToast('Could not fetch flat details', 'error');
    }
  }

  function closeEditModal() {
    editModal.classList.remove('show');
    editingFlat = null;
  }

  function togglePaymentFields(isPaid) {
    const paymentFields = document.getElementById('paymentFields');
    if (isPaid) {
      paymentFields.style.display = 'block';
      paymentFields.style.animation = 'slideUp 0.3s ease';
    } else {
      paymentFields.style.display = 'none';
    }
  }

  // ---- Save Flat ----
  async function saveFlat() {
    if (!editingFlat) return;

    const isPaid = document.getElementById('statusPaid').classList.contains('active');
    const ownerName = document.getElementById('editOwnerName').value.trim();
    const amountPaid = parseFloat(document.getElementById('editAmount').value) || 0;
    const paymentDate = document.getElementById('editPaymentDate').value || null;
    const receivedBy = document.getElementById('editReceivedBy').value.trim() || null;
    const bhandaraItems = document.getElementById('editBhandara').value.trim();

    const updates = {
      ownerName,
      isPaid,
      amountPaid: isPaid ? amountPaid : 0,
      paymentDate: isPaid ? paymentDate : null,
      receivedBy: isPaid ? receivedBy : null,
      bhandaraItems
    };

    try {
      const result = await updateFlat(editingFlat.flatNo, updates);
      showToast(`Flat ${editingFlat.flatNo} updated successfully!`, 'success');
      closeEditModal();
      await refreshData();
    } catch (err) {
      console.error('Error saving flat:', err);
      showToast('Failed to update flat on server', 'error');
    }
  }

  // ---- Search ----
  function performSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      renderBuilding();
      return;
    }
    const filtered = allFlatsCache.filter(f =>
      f.flatNo.toLowerCase().includes(q) ||
      (f.ownerName && f.ownerName.toLowerCase().includes(q))
    );
    renderBuilding(filtered);
  }

  // ---- Karykarta Management ----
  let allKarykartas = [];

  async function loadKarykartas() {
    try {
      const res = await fetch('/api/karykartas');
      if (res.ok) {
        allKarykartas = await res.json();
      } else {
        console.error('Failed to load karykartas from server');
        allKarykartas = [];
      }
      renderKarykartas();
    } catch (err) {
      console.error('Error loading karykartas:', err);
      allKarykartas = [];
      renderKarykartas();
    }
  }

  function renderKarykartas() {
    const container = document.getElementById('karykartaContainer');
    if (allKarykartas.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); grid-column: 1 / -1;">No Karykartas added yet.</div>`;
      return;
    }
    
    container.innerHTML = allKarykartas.map(k => `
      <div class="karykarta-card" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:15px; display:flex; flex-direction:column; gap:10px; position:relative;">
        <button class="delete-karykarta" data-id="${k.id}" style="position:absolute; top:10px; right:10px; background:none; border:none; cursor:pointer; font-size:1.2rem; color:var(--danger);" title="Delete">🗑️</button>
        <div style="display:flex; gap:15px; align-items:center;">
          ${k.photoBase64 ? 
            `<img src="${k.photoBase64}" style="width:60px; height:75px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);">` : 
            `<div style="width:60px; height:75px; background:var(--bg-primary); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👤</div>`
          }
          <div>
            <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${k.name}</div>
            <div style="font-size:0.9rem; color:var(--accent-primary); font-weight:500;">${k.position}</div>
          </div>
        </div>
        ${k.flatNo ? `<div style="font-size:0.85rem; color:var(--text-muted);"><strong>Flat:</strong> ${k.flatNo}</div>` : ''}
        ${k.details ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px; padding-top:10px; border-top:1px dashed var(--border-color);">${k.details}</div>` : ''}
      </div>
    `).join('');
  }

  // Handle Photo Upload & Resize
  let currentPhotoBase64 = null;
  document.getElementById('karykartaPhoto').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 150x200 (passport ratio)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('photoPreview').innerHTML = `<img src="${currentPhotoBase64}" style="width:100%; height:100%; object-fit:cover;">`;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ---- User Management ----
  let allUsers = [];

  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        allUsers = await res.json();
      } else {
        console.error('Failed to load users');
        allUsers = [];
      }
      renderUsers();
    } catch (err) {
      console.error('Error loading users:', err);
      allUsers = [];
      renderUsers();
    }
  }

  function renderUsers() {
    const container = document.getElementById('usersContainer');
    if (!container) return;

    if (allUsers.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-color);">No registered users found.</div>`;
      return;
    }

    container.innerHTML = allUsers.map(u => `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary);">${u.name} <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted); margin-left:8px;">(${u.role})</span></div>
          <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:3px;">📧 Email: <strong>${u.email}</strong></div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
             🏢 <strong>Flat No:</strong> <span style="color:var(--accent-primary); font-weight:600;">${u.flatNo || 'Not Assigned'}</span> 
             | 🔒 <strong>Password:</strong> Encrypted (SHA-256 Hash: <code>${u.passwordHash ? u.passwordHash.substring(0, 8) + '...' : 'N/A'}</code>)
          </div>
        </div>
        <div style="display:flex; gap: 10px;">
          <button class="btn btn-secondary edit-user" data-id="${u.id}" data-name="${u.name} (${u.email})" data-flat="${u.flatNo || ''}">✏️ Edit Flat/Pass</button>
          <button class="btn delete-user" style="background:var(--danger); color:white; border:none;" data-id="${u.id}" data-name="${u.name}">🗑️ Delete User</button>
        </div>
      </div>
    `).join('');
  }

  // ---- Event Listeners ----
  function setupEventListeners() {
    // Floor tabs
    floorTabsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('floor-tab')) {
        const df = e.target.dataset.floor;
        currentFloor = df === 'all' ? 'all' : parseInt(df);
        renderFloorTabs();
        renderBuilding();
      }
    });

    // Flat card click
    buildingContainer.addEventListener('click', (e) => {
      const flatCard = e.target.closest('.flat-card');
      if (flatCard) {
        openEditModal(flatCard.dataset.flat);
      }
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });

    // Save
    document.getElementById('saveEdit').addEventListener('click', saveFlat);

    // Payment status toggle
    document.getElementById('statusPaid').addEventListener('click', () => {
      document.getElementById('statusPaid').classList.add('active');
      document.getElementById('statusUnpaid').classList.remove('active');
      togglePaymentFields(true);
    });

    document.getElementById('statusUnpaid').addEventListener('click', () => {
      document.getElementById('statusUnpaid').classList.add('active');
      document.getElementById('statusPaid').classList.remove('active');
      togglePaymentFields(false);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Karykarta UI
    document.getElementById('addKarykartaBtn').addEventListener('click', () => {
      document.getElementById('addKarykartaForm').reset();
      currentPhotoBase64 = null;
      document.getElementById('photoPreview').innerHTML = '<span style="font-size: 2rem; color: var(--text-muted);">📷</span>';
      document.getElementById('addKarykartaModal').classList.add('show');
    });

    const closeKarykartaModal = () => document.getElementById('addKarykartaModal').classList.remove('show');
    document.getElementById('karykartaModalClose').addEventListener('click', closeKarykartaModal);
    document.getElementById('cancelKarykarta').addEventListener('click', closeKarykartaModal);

    document.getElementById('addKarykartaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('karykartaName').value.trim();
      const position = document.getElementById('karykartaPosition').value.trim();
      const flatNo = document.getElementById('karykartaFlat').value.trim();
      const details = document.getElementById('karykartaDetails').value.trim();

      const payload = { name, position, flatNo, photoBase64: currentPhotoBase64, details };

      try {
        const res = await fetch('/api/karykartas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Member added successfully!', 'success');
        } else {
          showToast('Failed to add member on server', 'error');
        }
      } catch (err) {
        console.error('Error adding member:', err);
        showToast('Network error adding member', 'error');
      }
      closeKarykartaModal();
      loadKarykartas();
    });

    document.getElementById('karykartaContainer').addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-karykarta')) {
        if (!confirm('Are you sure you want to remove this Karykarta?')) return;
        const id = parseInt(e.target.dataset.id);
        
        try {
          const res = await fetch(`/api/karykartas/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Member deleted.', 'success');
          } else {
            showToast('Failed to delete member from server', 'error');
          }
        } catch (err) {
          console.error('Error deleting member:', err);
          showToast('Network error deleting member', 'error');
        }
        loadKarykartas();
      }
    });

    // Admin Bhandara UI
    const addBhandaraModal = document.getElementById('addBhandaraModal');
    
    document.getElementById('addBhandaraBtn').addEventListener('click', () => {
      document.getElementById('addBhandaraForm').reset();
      
      const flatSelect = document.getElementById('bhandaraFlatNo');
      flatSelect.innerHTML = '<option value="">Select a flat...</option>' + 
        allFlatsCache.map(f => `<option value="${f.flatNo}">Flat ${f.flatNo} ${f.ownerName ? '- ' + f.ownerName : ''}</option>`).join('');
        
      addBhandaraModal.classList.add('show');
    });

    const closeBhandaraModal = () => addBhandaraModal.classList.remove('show');
    document.getElementById('bhandaraModalClose').addEventListener('click', closeBhandaraModal);
    document.getElementById('cancelBhandara').addEventListener('click', closeBhandaraModal);

    document.getElementById('addBhandaraForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const flatNo = document.getElementById('bhandaraFlatNo').value;
      const items = document.getElementById('adminBhandaraItems').value.trim();

      try {
        const res = await fetch('/api/admin/bhandara', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flatNo, items })
        });
        const result = await res.json();
        
        if (res.ok && result.success) {
          showToast('Donation added successfully!', 'success');
          closeBhandaraModal();
          await refreshData();
        } else {
          showToast(result.error || 'Failed to add donation', 'error');
        }
      } catch (err) {
        console.error('Error adding donation:', err);
        showToast('Network error while adding donation', 'error');
      }
    });

    // Admin Journey UI
    let allJourneyData = [];
    async function loadJourneyData() {
      try {
        const res = await fetch('/api/journey');
        if (res.ok) {
          allJourneyData = await res.json();
        }
        renderJourney();
      } catch (err) {
        console.error('Error loading journey data:', err);
      }
    }

    function renderJourney() {
      const container = document.getElementById('journeyContainer');
      if (!container) return;
      
      let html = '';
      for (let year = 2010; year <= 2025; year++) {
        const data = allJourneyData.find(j => j.year === year);
        const hasImage = data && data.imageBase64;
        
        html += `
          <div class="journey-card" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:20px; text-align:center; display:flex; flex-direction:column; gap:10px; cursor:pointer;" onclick="document.getElementById('journeyUpload_${year}').click()">
            <div style="font-size:2rem; font-weight:800; font-family:'Outfit', sans-serif; color:var(--accent-primary);">${year}</div>
            <div class="journey-image-container" style="height:140px; background:var(--bg-primary); border-radius:8px; display:flex; align-items:center; justify-content:center; border:2px dashed var(--border-color);">
              ${hasImage ? `<img src="${data.imageBase64}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:2rem; color:var(--text-muted);">📷</span>`}
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${hasImage ? 'Click to change image' : 'Click to upload image'}</div>
            <input type="file" id="journeyUpload_${year}" accept="image/*" style="display:none;" onchange="handleJourneyUpload(event, ${year})">
          </div>
        `;
      }
      container.innerHTML = html;
    }

    window.handleJourneyUpload = function(event, year) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          
          try {
            const res = await fetch('/api/admin/journey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ year, imageBase64: base64 })
            });
            if (res.ok) {
              showToast(`Journey image for ${year} updated!`, 'success');
              loadJourneyData();
            } else {
              showToast('Failed to update image', 'error');
            }
          } catch (err) {
            showToast('Network error', 'error');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    // Admin Users UI
    const editUserModal = document.getElementById('editUserModal');
    
    window.closeUserModal = function() {
      if(editUserModal) editUserModal.classList.remove('show');
    };

    if (document.getElementById('userModalClose')) {
      document.getElementById('userModalClose').addEventListener('click', closeUserModal);
    }
    if (document.getElementById('cancelUserEdit')) {
      document.getElementById('cancelUserEdit').addEventListener('click', closeUserModal);
    }

    if (document.getElementById('usersContainer')) {
      document.getElementById('usersContainer').addEventListener('click', async (e) => {
        // Edit User
        if (e.target.classList.contains('edit-user')) {
          const id = e.target.dataset.id;
          const name = e.target.dataset.name;
          const flatNo = e.target.dataset.flat;

          document.getElementById('editUserId').value = id;
          document.getElementById('editUserName').value = name;
          document.getElementById('editUserFlat').value = flatNo;
          document.getElementById('editUserPassword').value = '';
          
          editUserModal.classList.add('show');
        }

        // Delete User
        if (e.target.classList.contains('delete-user')) {
          const userName = e.target.dataset.name || 'this user';
          if (!confirm(`Are you sure you want to delete ${userName}? They will have to register again.`)) return;
          const id = e.target.dataset.id;
          
          try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
              showToast('User deleted successfully.', 'success');
              loadUsers();
            } else {
              showToast('Failed to delete user', 'error');
            }
          } catch (err) {
            console.error('Error deleting user:', err);
            showToast('Network error while deleting user', 'error');
          }
        }
      });
    }

    if (document.getElementById('editUserForm')) {
      document.getElementById('editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editUserId').value;
        const flatNo = document.getElementById('editUserFlat').value.trim();
        const newPassword = document.getElementById('editUserPassword').value.trim();

        try {
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flatNo, newPassword })
          });
          const result = await res.json();
          
          if (res.ok && result.success) {
            showToast('User account updated successfully!', 'success');
            closeUserModal();
            loadUsers();
          } else {
            showToast(result.error || 'Failed to update user', 'error');
          }
        } catch (err) {
          console.error('Error updating user:', err);
          showToast('Network error while updating user', 'error');
        }
      });
    }

    // Keyboard shortcut - Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEditModal();
        closeKarykartaModal();
        if (typeof closeBhandaraModal !== 'undefined') closeBhandaraModal();
        if (typeof closeUserModal !== 'undefined') closeUserModal();
      }
    });

    // Initial load
    loadKarykartas();
    loadJourneyData();
    loadUsers();

    function handleLogoUpload(file) {
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 500;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/png');
          
          const preview = document.getElementById('currentLogoPreview');
          if (preview) preview.src = base64;

          try {
            const res = await fetch('/api/admin/logo', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({imageBase64: base64})
            });
            const data = await res.json();
            if (res.ok && data.success) {
              showToast('Logo updated successfully!', 'success');
              const t = new Date().getTime();
              document.querySelectorAll('img[src*="logo.png"]').forEach(el => {
                el.src = '/static/images/logo.png?t=' + t;
              });
            } else {
              showToast(data.message || 'Failed to upload logo.', 'error');
            }
          } catch (err) {
            console.error(err);
            showToast('Error uploading logo.', 'error');
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    const logoUpload = document.getElementById('logoUpload');
    if (logoUpload) {
      logoUpload.addEventListener('change', (e) => handleLogoUpload(e.target.files[0]));
    }
    const logoUploadSection = document.getElementById('logoUploadSection');
    if (logoUploadSection) {
      logoUploadSection.addEventListener('change', (e) => handleLogoUpload(e.target.files[0]));
    }
  }
});
