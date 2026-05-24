/* ============================================
   نَسَق · Workflow Builder Interactions
   ============================================ */

(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const canvasInner = document.getElementById('canvasInner');
  const svg = document.getElementById('connectionsSvg');
  const propsPanel = document.getElementById('propsPanel');
  const blockCountEl = document.getElementById('blockCount');

  // ---- State ----
  let nodeCounter = 100;
  let connections = [
    { from: 'node1', to: 'node2', fromPort: 'out', toPort: 'in' },
    { from: 'node2', to: 'node3', fromPort: 'out', toPort: 'in' },
    { from: 'node3', to: 'node4', fromPort: 'out', toPort: 'in' },
    { from: 'node4', to: 'node5', fromPort: 'yes', toPort: 'in' },
    { from: 'node4', to: 'node6', fromPort: 'no', toPort: 'in' },
  ];

  let selectedNode = null;
  let pendingConnection = null;
  let zoom = 1;

  // ---- Arabic numeral helper ----
  const toArabic = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

  // ============================================
  // CONNECTION DRAWING
  // ============================================

  function getPortPosition(nodeId, portType) {
    const node = canvasInner.querySelector(`[data-id="${nodeId}"]`);
    if (!node) return null;

    const canvasRect = canvasInner.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    const baseX = (nodeRect.left - canvasRect.left) / zoom;
    const baseY = (nodeRect.top - canvasRect.top) / zoom;
    const width = nodeRect.width / zoom;
    const height = nodeRect.height / zoom;

    if (portType === 'in') {
      return { x: baseX + width / 2, y: baseY };
    } else if (portType === 'out') {
      return { x: baseX + width / 2, y: baseY + height };
    } else if (portType === 'yes') {
      return { x: baseX + width * 0.3, y: baseY + height };
    } else if (portType === 'no') {
      return { x: baseX + width * 0.7, y: baseY + height };
    }
    return null;
  }

  function buildPath(from, to) {
    if (!from || !to) return '';
    const dy = to.y - from.y;
    const midY = from.y + dy / 2;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }

  function renderConnections() {
    svg.innerHTML = '';
    svg.setAttribute('width', canvasInner.scrollWidth || 2000);
    svg.setAttribute('height', canvasInner.scrollHeight || 2000);

    connections.forEach((c, idx) => {
      const from = getPortPosition(c.from, c.fromPort);
      const to = getPortPosition(c.to, c.toPort);
      if (!from || !to) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', buildPath(from, to));
      path.setAttribute('class', 'wf-conn wf-conn-active');
      path.setAttribute('data-idx', idx);
      svg.appendChild(path);

      // Label for yes/no branches
      if (c.fromPort === 'yes' || c.fromPort === 'no') {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const label = c.fromPort === 'yes' ? 'نعم' : 'لا';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', midX - 18);
        rect.setAttribute('y', midY - 10);
        rect.setAttribute('width', 36);
        rect.setAttribute('height', 20);
        rect.setAttribute('rx', 10);
        rect.setAttribute('class', 'wf-conn-label-bg');
        svg.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'wf-conn-label');
        text.textContent = label;
        svg.appendChild(text);
      }
    });

    updateBlockCount();
  }

  function updateBlockCount() {
    const count = canvasInner.querySelectorAll('.wf-node').length;
    if (blockCountEl) blockCountEl.textContent = toArabic(count);
  }

  // ============================================
  // NODE DRAGGING
  // ============================================

  let draggedNode = null;
  let dragOffset = { x: 0, y: 0 };

  canvasInner.addEventListener('mousedown', e => {
    const node = e.target.closest('.wf-node');
    if (!node) return;

    // Don't start drag on ports or menu buttons
    if (e.target.closest('.wf-port') || e.target.closest('.wf-node-menu')) return;

    e.preventDefault();
    draggedNode = node;
    selectNode(node);

    const rect = node.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    node.style.zIndex = '20';
  });

  document.addEventListener('mousemove', e => {
    if (!draggedNode) return;

    const canvasRect = canvas.getBoundingClientRect();
    let newLeft = (e.clientX - canvasRect.left - dragOffset.x) / zoom;
    let newTop = (e.clientY - canvasRect.top - dragOffset.y) / zoom;

    // Snap to 12px grid for cleanliness
    newLeft = Math.round(newLeft / 12) * 12;
    newTop = Math.round(newTop / 12) * 12;

    // Remove any "right" positioning since we're using left now
    draggedNode.style.right = 'auto';
    draggedNode.style.left = newLeft + 'px';
    draggedNode.style.top = newTop + 'px';

    renderConnections();
  });

  document.addEventListener('mouseup', () => {
    if (draggedNode) {
      draggedNode.style.zIndex = '';
      draggedNode = null;
    }
  });

  // ============================================
  // NODE SELECTION
  // ============================================

  function selectNode(node) {
    canvasInner.querySelectorAll('.wf-node').forEach(n => n.classList.remove('selected'));
    node.classList.add('selected');
    selectedNode = node;
    updatePropsPanel(node);
  }

  function updatePropsPanel(node) {
    const title = node.querySelector('.wf-node-title')?.textContent || '';
    const tag = node.querySelector('.wf-node-tag')?.textContent || '';
    const iconWrap = node.querySelector('.wf-node-head .block-icon');
    const iconClass = iconWrap?.className.replace('block-icon', '').trim() || 'lime';
    const iconHTML = iconWrap?.innerHTML || '';

    propsPanel.querySelector('.props-title').textContent = title;
    propsPanel.querySelector('.props-tag').textContent = tag;

    const propsIcon = propsPanel.querySelector('.props-head .block-icon');
    propsIcon.className = `block-icon ${iconClass}`;
    propsIcon.innerHTML = iconHTML;
  }

  // ============================================
  // DRAG NEW BLOCK FROM SIDEBAR
  // ============================================

  document.querySelectorAll('.block-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      const data = {
        type: item.dataset.type,
        name: item.dataset.name,
        icon: item.dataset.icon,
        tag: item.dataset.tag,
        iconHTML: item.querySelector('.block-icon').innerHTML,
      };
      e.dataTransfer.setData('text/plain', JSON.stringify(data));
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => item.classList.remove('dragging'));
  });

  canvas.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', e => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const canvasRect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - canvasRect.left) / zoom / 12) * 12;
      const y = Math.round((e.clientY - canvasRect.top) / zoom / 12) * 12;

      createNode(data, x, y);
    } catch (err) {
      console.warn('Drop failed:', err);
    }
  });

  function createNode(data, x, y) {
    nodeCounter++;
    const id = 'node' + nodeCounter;

    const isTrigger = data.type === 'trigger';
    const isCondition = data.name === 'شرط';

    let portsHTML = '';
    if (!isTrigger) {
      portsHTML += '<button class="wf-port in" data-port="in"></button>';
    }
    if (isCondition) {
      portsHTML += '<button class="wf-port out-yes" data-port="yes"></button>';
      portsHTML += '<button class="wf-port out-no" data-port="no"></button>';
    } else {
      portsHTML += '<button class="wf-port out" data-port="out"></button>';
    }

    const tagText = data.type === 'trigger' ? 'مُحفّز · TRIGGER'
                  : data.type === 'logic' ? `${data.tag} · LOGIC`
                  : 'إجراء · ACTION';

    const html = `
      <div class="wf-node ${isTrigger ? 'trigger' : ''}" style="top:${y}px; left:${x}px;" data-id="${id}">
        ${portsHTML}
        <div class="wf-node-head">
          <div class="block-icon ${data.icon}">${data.iconHTML}</div>
          <div>
            <div class="wf-node-tag">${tagText}</div>
            <div class="wf-node-title">${data.name}</div>
          </div>
          <button class="wf-node-menu"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>
        </div>
        <div class="wf-node-body">
          <div class="wf-node-detail">
            <span class="key">الحالة:</span>
            <span class="val">يحتاج إعداد</span>
          </div>
        </div>
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    const newNode = temp.firstChild;
    canvasInner.appendChild(newNode);

    // Animate in
    newNode.style.opacity = '0';
    newNode.style.transform = 'scale(0.9)';
    requestAnimationFrame(() => {
      newNode.style.transition = 'opacity 0.25s, transform 0.25s';
      newNode.style.opacity = '1';
      newNode.style.transform = 'scale(1)';
    });

    selectNode(newNode);
    renderConnections();
  }

  // ============================================
  // PORT CONNECTIONS
  // ============================================

  canvasInner.addEventListener('click', e => {
    const port = e.target.closest('.wf-port');
    if (!port) return;
    e.stopPropagation();

    const node = port.closest('.wf-node');
    const nodeId = node.dataset.id;
    const portType = port.dataset.port;
    const isInput = portType === 'in';

    if (!pendingConnection) {
      // Start connection
      if (isInput) {
        showToast('ابدأ الربط من منفذ خروج (أسفل البلوك)');
        return;
      }
      pendingConnection = { from: nodeId, fromPort: portType };
      port.style.background = 'var(--lime)';
      port.style.borderColor = 'var(--lime)';
      showToast('اختر منفذ دخول البلوك التالي');
    } else {
      // Complete connection
      if (!isInput) {
        showToast('اربط بمنفذ دخول (أعلى البلوك)');
        return;
      }
      if (pendingConnection.from === nodeId) {
        showToast('لا تربط البلوك بنفسه');
        cancelPending();
        return;
      }

      connections.push({
        from: pendingConnection.from,
        to: nodeId,
        fromPort: pendingConnection.fromPort,
        toPort: 'in'
      });
      cancelPending();
      renderConnections();
      showToast('تم الربط ✓', 'success');
    }
  });

  function cancelPending() {
    canvasInner.querySelectorAll('.wf-port').forEach(p => {
      p.style.background = '';
      p.style.borderColor = '';
    });
    pendingConnection = null;
  }

  // Click empty canvas → cancel pending + deselect
  canvas.addEventListener('click', e => {
    if (e.target.closest('.wf-node') || e.target.closest('.wf-port')) return;
    if (pendingConnection) cancelPending();
  });

  // ============================================
  // ZOOM
  // ============================================

  const zoomLevelEl = document.getElementById('zoomLevel');

  function applyZoom() {
    canvasInner.style.transform = `scale(${zoom})`;
    if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
    renderConnections();
  }

  document.getElementById('zoomIn')?.addEventListener('click', () => {
    zoom = Math.min(zoom + 0.1, 2);
    applyZoom();
  });
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    zoom = Math.max(zoom - 0.1, 0.4);
    applyZoom();
  });
  document.getElementById('zoomFit')?.addEventListener('click', () => {
    zoom = 1;
    applyZoom();
  });

  // ============================================
  // RUN BUTTON
  // ============================================

  const runBtn = document.getElementById('runBtn');
  const runBtnText = document.getElementById('runBtnText');
  const runBanner = document.getElementById('runBanner');
  let running = false;

  runBtn?.addEventListener('click', () => {
    running = !running;
    if (running) {
      runBtnText.textContent = 'إيقاف';
      runBtn.style.background = 'var(--rose)';
      runBanner.style.display = 'flex';
      animateFlow();
      showToast('الأتمتة شغّالة الآن ⚡', 'success');
    } else {
      runBtnText.textContent = 'شغّل الأتمتة';
      runBtn.style.background = '';
      runBanner.style.display = 'none';
      showToast('تم إيقاف الأتمتة');
    }
  });

  function animateFlow() {
    if (!running) return;

    const nodes = canvasInner.querySelectorAll('.wf-node');
    let i = 0;
    const interval = setInterval(() => {
      if (!running || i >= nodes.length) {
        clearInterval(interval);
        nodes.forEach(n => n.style.boxShadow = '');
        if (running) setTimeout(animateFlow, 1500);
        return;
      }
      nodes.forEach(n => n.style.boxShadow = '');
      nodes[i].style.boxShadow = '0 0 0 2px var(--lime), 0 0 40px rgba(199, 249, 80, 0.4)';
      i++;
    }, 700);
  }

  // ============================================
  // TOAST
  // ============================================

  let toastTimer = null;
  function showToast(message, type = 'info') {
    let toast = document.getElementById('wf-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wf-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: var(--ink-2);
        border: 1px solid var(--line);
        border-radius: 100px;
        padding: 12px 24px;
        font-size: 0.88rem;
        font-family: var(--font-body);
        color: var(--text-1);
        z-index: 1000;
        transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.borderColor = type === 'success' ? 'var(--lime)' : 'var(--line)';
    toast.style.color = type === 'success' ? 'var(--lime)' : 'var(--text-1)';

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, 2200);
  }

  // ============================================
  // PORT HOVER preview
  // ============================================

  document.addEventListener('mousemove', e => {
    if (!pendingConnection) return;

    const fromPos = getPortPosition(pendingConnection.from, pendingConnection.fromPort);
    if (!fromPos) return;

    const canvasRect = canvasInner.getBoundingClientRect();
    const toX = (e.clientX - canvasRect.left) / zoom;
    const toY = (e.clientY - canvasRect.top) / zoom;

    // Remove old preview
    const old = svg.querySelector('.wf-conn-preview');
    if (old) old.remove();

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', buildPath(fromPos, { x: toX, y: toY }));
    path.setAttribute('class', 'wf-conn wf-conn-preview');
    path.setAttribute('stroke', 'var(--lime)');
    path.setAttribute('stroke-dasharray', '4 4');
    path.setAttribute('opacity', '0.6');
    svg.appendChild(path);
  });

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  document.addEventListener('keydown', e => {
    // Delete selected node
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && !e.target.matches('input, textarea, select')) {
      const nodeId = selectedNode.dataset.id;
      // Don't allow deleting trigger
      if (selectedNode.classList.contains('trigger')) {
        showToast('لا يمكن حذف المُحفّز');
        return;
      }
      selectedNode.remove();
      connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
      selectedNode = null;
      renderConnections();
      showToast('تم الحذف');
    }

    // Escape - cancel pending
    if (e.key === 'Escape') {
      if (pendingConnection) cancelPending();
    }

    // Cmd/Ctrl + S
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      showToast('تم الحفظ ✓', 'success');
    }
  });

  // ============================================
  // INIT
  // ============================================

  // Wait for fonts/layout
  setTimeout(() => {
    renderConnections();
  }, 100);

  window.addEventListener('resize', renderConnections);

  // Node click → select
  canvasInner.addEventListener('click', e => {
    const node = e.target.closest('.wf-node');
    if (node && !e.target.closest('.wf-port') && !e.target.closest('.wf-node-menu')) {
      selectNode(node);
    }
  });

})();
