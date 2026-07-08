/* ============================================
   RAMBAUGCHI MATARANI 2026 - USER PANEL (AJAX)
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await requireAuth('user');
  if (!auth) return;

  const flatNo = auth.flatNo;
  let flat = null;

  try {
    flat = await getFlatById(flatNo);
    renderFlatDetails(flat);
    
    // Pre-fill bhandara items if already donated
    if (flat.bhandaraItems) {
      document.getElementById('bhandaraItemsInput').value = flat.bhandaraItems;
    }
    
    await renderBuildingOverview(flatNo);
    setupEventListeners();
  } catch (err) {
    console.error('Failed to initialize resident panel:', err);
    showToast('Failed to load details from server', 'error');
    setTimeout(() => logout(), 2000);
  }

  // ---- Render Flat Details ----
  function renderFlatDetails(flat) {
    const detailsContainer = document.getElementById('flatDetails');
    const statusClass = flat.isPaid ? 'paid' : 'unpaid';
    const statusText = flat.isPaid ? '✅ PAID' : '⏳ UNPAID';

    detailsContainer.innerHTML = `
      <div class="flat-detail-card">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800;">
              Flat ${flat.flatNo}
            </h2>
            <p style="color:var(--text-secondary); font-size:0.9rem;">${flat.floor === 0 ? 'Ground Floor' : `Floor ${flat.floor}`} • ${APP.SOCIETY_NAME}</p>
          </div>
          <span class="payment-badge ${statusClass}">${statusText}</span>
        </div>

        <div class="flat-info-grid">
          <div class="flat-info-item">
            <span class="label">Owner Name</span>
            <span class="value">${flat.ownerName || '—'}</span>
          </div>
          <div class="flat-info-item">
            <span class="label">Flat Number</span>
            <span class="value">${flat.flatNo}</span>
          </div>
          <div class="flat-info-item">
            <span class="label">Floor</span>
            <span class="value">${flat.floor === 0 ? 'Ground Floor' : flat.floor}</span>
          </div>
          <div class="flat-info-item">
            <span class="label">Payment Status</span>
            <span class="value" style="color:${flat.isPaid ? 'var(--success)' : 'var(--danger)'}">${flat.isPaid ? 'Paid' : 'Unpaid'}</span>
          </div>
          ${flat.isPaid ? `
            <div class="flat-info-item">
              <span class="label">Amount Paid</span>
              <span class="value">${formatCurrency(flat.amountPaid)}</span>
            </div>
            <div class="flat-info-item">
              <span class="label">Payment Date</span>
              <span class="value">${formatDate(flat.paymentDate)}</span>
            </div>
            <div class="flat-info-item">
              <span class="label">Receipt No</span>
              <span class="value" style="font-size:1rem; color:var(--accent-primary-light);">${flat.receiptNo || '—'}</span>
            </div>
          ` : ''}
        </div>

        ${flat.isPaid ? `
          <div class="download-section">
            <div class="download-info">
              <h3>📄 Payment Receipt</h3>
              <p>Download your payment receipt in PDF format</p>
            </div>
            <button class="btn-download" id="downloadReceiptBtn" onclick="downloadReceipt()">
              <span>⬇️</span> Download PDF
            </button>
          </div>
        ` : `
          <div class="download-section" style="border-color: var(--danger-border); background: var(--danger-bg);">
            <div class="download-info">
              <h3>📄 Payment Receipt</h3>
              <p style="color:var(--danger);">Receipt will be available after payment is completed</p>
            </div>
            <button class="btn-download" disabled>
              <span>⬇️</span> Not Available
            </button>
          </div>
        `}
      </div>
    `;
  }

  // ---- Building Overview (Read-Only) ----
  async function renderBuildingOverview(currentFlatNo) {
    const container = document.getElementById('buildingOverview');
    let html = `
      <div class="legend">
        <div class="legend-item"><span class="legend-dot paid"></span> Paid</div>
        <div class="legend-item"><span class="legend-dot unpaid"></span> Unpaid</div>
      </div>
    `;

    try {
      const allFlats = await getAllFlats();

      for (let floor = APP.TOTAL_FLOORS; floor >= 0; floor--) {
        const flats = allFlats.filter(f => f.floor === floor);
        html += `
          <div class="floor-section">
            <div class="floor-label">
              <span>🏗️</span> ${floor === 0 ? 'Ground Floor' : `Floor <span class="floor-num">${floor}</span>`}
              <span style="margin-left:auto; font-size:0.8rem; font-weight:400; color:var(--text-muted);">
                ${flats.filter(f => f.isPaid).length}/${flats.length} Paid
              </span>
            </div>
            <div class="flats-grid">
              ${flats.map(f => `
                <div class="flat-card ${f.isPaid ? 'paid' : 'unpaid'} ${f.flatNo === currentFlatNo ? 'my-flat' : ''}"
                     style="${f.flatNo === currentFlatNo ? 'border-width:2px; border-color:var(--accent-primary); box-shadow: 0 0 15px var(--accent-glow);' : ''}">
                  <div class="flat-number">${f.flatNo}</div>
                  <div class="flat-owner">${f.ownerName || '—'}</div>
                  <div class="flat-status">${f.isPaid ? '● Paid' : '○ Unpaid'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      container.innerHTML = html;
    } catch (err) {
      console.error('Failed to render overview:', err);
    }
  }

  // ---- Karykarta Management ----
  let allKarykartasData = [];
  async function renderKarykartas() {
    const container = document.getElementById('karykartaContainer');
    try {
      const res = await fetch('/api/karykartas');
      if (res.ok) {
        allKarykartasData = await res.json();
      } else {
        console.error('Failed to fetch karykartas from server');
        allKarykartasData = [];
      }
    } catch (err) {
      console.error('Failed to fetch karykartas:', err);
      allKarykartasData = [];
    }

    if (allKarykartasData.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); grid-column: 1 / -1;">No Karykartas added yet.</div>`;
      return;
    }
    
    container.innerHTML = allKarykartasData.map(k => `
      <div class="karykarta-card hover-glow" data-id="${k.id}" style="cursor:pointer; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:15px; display:flex; flex-direction:column; gap:10px; transition: transform 0.2s ease, box-shadow 0.2s ease;">
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

  // ---- Event Listeners ----
  function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Save Bhandara Donation
    const saveBhandaraBtn = document.getElementById('saveBhandaraBtn');
    if (saveBhandaraBtn) {
      saveBhandaraBtn.addEventListener('click', async () => {
        const originalText = saveBhandaraBtn.textContent;
        saveBhandaraBtn.textContent = 'Saving...';
        saveBhandaraBtn.disabled = true;
        
        const items = document.getElementById('bhandaraItemsInput').value;
        try {
          const res = await fetch('/api/user/bhandara', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const result = await res.json();
          if (result.success) {
            showToast('Donation details saved successfully!', 'success');
            flat.bhandaraItems = items;
          } else {
            showToast(result.error || 'Failed to save donation', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Network error while saving donation', 'error');
        } finally {
          saveBhandaraBtn.textContent = originalText;
          saveBhandaraBtn.disabled = false;
        }
      });
    }

    // Karykarta Modal interactions
    document.getElementById('karykartaContainer').addEventListener('click', (e) => {
      const card = e.target.closest('.karykarta-card');
      if (!card) return;
      
      const id = parseInt(card.dataset.id);
      const k = allKarykartasData.find(x => x.id === id);
      if (!k) return;

      const detailContent = document.getElementById('karykartaDetailContent');
      detailContent.innerHTML = `
        ${k.photoBase64 ? 
          `<img src="${k.photoBase64}" style="width:120px; height:150px; object-fit:cover; border-radius:12px; border:2px solid var(--border-color); box-shadow: 0 4px 15px rgba(0,0,0,0.2);">` : 
          `<div style="width:120px; height:150px; background:var(--bg-primary); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:3rem; border:2px solid var(--border-color);">👤</div>`
        }
        <div style="margin-top: 10px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 5px; color: var(--text-primary);">${k.name}</h2>
          <div style="font-size: 1.1rem; color: var(--accent-primary); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${k.position}</div>
        </div>
        ${k.flatNo ? `<div style="font-size: 1rem; color: var(--text-muted); background: var(--bg-primary); padding: 5px 15px; border-radius: 20px;"><strong>Flat:</strong> ${k.flatNo}</div>` : ''}
        ${k.details ? `<div style="font-size: 1rem; color: var(--text-muted); margin-top: 10px; line-height: 1.5; padding: 15px; border-top: 1px dashed var(--border-color); width: 100%; text-align: left;">${k.details.replace(/\\n/g, '<br>')}</div>` : ''}
      `;
      
      document.getElementById('karykartaDetailModal').classList.add('show');
    });

    const closeKarykartaModal = () => document.getElementById('karykartaDetailModal').classList.remove('show');
    document.getElementById('karykartaDetailClose').addEventListener('click', closeKarykartaModal);
    document.getElementById('karykartaDetailModal').addEventListener('click', (e) => {
      if (e.target.id === 'karykartaDetailModal') closeKarykartaModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeKarykartaModal();
    });

    // Nav items
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        document.getElementById(section).style.display = 'block';

        if (section === 'karykartaSection') {
          renderKarykartas();
        }
        if (section === 'journeySection') {
          loadJourneyData();
        }

        // Close mobile sidebar if open
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          sidebarOverlay.classList.remove('show');
        }
      });
    });

    // Mobile sidebar
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
      });
    }
    
    // Initial Load for Journey
    loadJourneyData();
  }
});

window.userJourneyData = [];

// ---- Journey Rendering ----
async function loadJourneyData() {
  try {
    const res = await fetch('/api/journey');
    if (!res.ok) return;
    window.userJourneyData = await res.json();
    
    const container = document.getElementById('userJourneyContainer');
    if (!container) return;
    
    let html = '';
    for (let year = 2010; year <= 2025; year++) {
      const yearData = window.userJourneyData.find(j => j.year === year);
      const hasImage = yearData && yearData.imageBase64;
      
      html += `
        <div class="journey-card" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; padding:20px; text-align:center; display:flex; flex-direction:column; gap:10px; ${hasImage ? 'cursor:pointer;' : ''}" ${hasImage ? `onclick="openJourneyModal(${year})"` : ''}>
          <div style="font-size:2.5rem; font-weight:800; font-family:'Outfit', sans-serif; color:var(--accent-primary);">${year}</div>
          <div class="journey-image-container" style="height:180px; background:var(--bg-primary); border-radius:8px; display:flex; align-items:center; justify-content:center; border:2px dashed var(--border-color);">
            ${hasImage ? `<img src="${yearData.imageBase64}" style="width:100%; height:100%; object-fit:cover; border-radius: 4px;">` : `<span style="font-size:1.5rem; color:var(--text-muted); font-family: 'Outfit', sans-serif;">Coming Soon</span>`}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading journey data:', err);
  }
}

window.openJourneyModal = function(year) {
  const data = window.userJourneyData.find(j => j.year === year);
  if (!data || !data.imageBase64) return;
  
  const content = document.getElementById('journeyDetailContent');
  content.innerHTML = `
    <h3 style="font-size: 2.5rem; color: var(--accent-primary); margin-bottom: 20px; font-family: 'Outfit', sans-serif;">${year}</h3>
    <img src="${data.imageBase64}" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
  `;
  document.getElementById('journeyDetailModal').classList.add('show');
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img[src^="/static/images/logo.png"]').forEach(img => {
    img.src = '/static/images/logo.png?t=' + new Date().getTime();
  });

  const closeBtn = document.getElementById('journeyDetailClose');
  const modal = document.getElementById('journeyDetailModal');
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }
});

// ---- PDF Receipt Download (Global) ----
async function downloadReceipt() {
  const auth = await getAuth();
  if (!auth) return;

  try {
    const flat = await getFlatById(auth.flatNo);
    if (!flat || !flat.isPaid) {
      showToast('Receipt not available. Payment not completed.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // ---- Header Background ----
    doc.setFillColor(128, 0, 0); // Maroon header
    doc.rect(0, 0, pageWidth, 50, 'F');

    // ---- Title ----
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RAMBAUGCHI MATARANI', pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Navratri Festival 2026', pageWidth / 2, 32, { align: 'center' });

    doc.setFontSize(10);
    doc.text('DONATION PAVATI', pageWidth / 2, 44, { align: 'center' });

    y = 65;

    // ---- Receipt Details ----
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(128, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Receipt No:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(flat.receiptNo || '—', margin + 35, y);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth - margin - 60, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(flat.paymentDate), pageWidth - margin - 40, y);

    y += 20;

    const details = [
      ['Flat Number', flat.flatNo],
      ['Floor', flat.floor === 0 ? 'Ground Floor' : `Floor ${flat.floor}`],
      ['Donor Name', flat.ownerName || '—'],
      ['Donation Amount', formatCurrency(flat.amountPaid).replace('₹', 'Rs. ')],
      ['Payment Date', formatDate(flat.paymentDate)],
      ['Payment Status', 'PAID'],
      ['Received By', flat.receivedBy || 'Admin']
    ];

    if (flat.bhandaraItems && flat.bhandaraItems.trim() !== '') {
      details.push(['Bhandara Items', flat.bhandaraItems]);
    }

    details.forEach(([label, value], index) => {
      if (index % 2 === 0) {
        doc.setFillColor(255, 245, 245);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 14, 'F');
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin + 5, y + 3);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(String(value), pageWidth / 2, y + 3);

      y += 14;
    });

    // ---- Footer ----
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an automatically generated receipt.', pageWidth / 2, y, { align: 'center' });

    // ---- Save PDF ----
    doc.save(`Rambaugchi-Matarani-Receipt_${flat.flatNo}.pdf`);
    showToast('Receipt downloaded successfully!', 'success');
  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast('Failed to generate receipt PDF.', 'error');
  }
}
