// ==UserScript==
// @name         X (Twitter) Ultra Cleaner Pro - Hybrid Delete
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  Now handles both Deleting Posts and Undoing Reposts automatically.
// @author       Syed Aun Naqvi
// @match        https://x.com/*
// @grant        none
// @license      GPL-3.0-or-later
// ==/UserScript==

(function () {
    'use strict';

    let isRunning = false;
    let actionCount = 0;
    let currentTab = 'unlike';
    let speedMode = 'preset';
    let themeIndex = 0;
    let isMinimized = false;

    let minDelay = 1200;
    let maxDelay = 2400;

    const themes = ['light', 'dark', 'amoled'];
    const presets = { slow: [2500, 4500], normal: [1200, 2400], fast: [600, 1200] };

    /* =======================
       STYLES
    ======================== */
    const style = document.createElement('style');
    style.innerHTML = `
        #x-cleaner-ui {
            position: fixed; top: 90px; right: 20px; width: 330px; z-index: 2147483647;
            border-radius: 18px; border: 1px solid var(--border);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: system-ui, sans-serif;
            color: var(--text); background: var(--bg); user-select: none; transition: width 0.3s, height 0.3s, border-radius 0.3s, left 0.3s;
        }
        #x-cleaner-ui.minimized { width: 60px; height: 60px; border-radius: 50%; overflow: visible; }
        #x-cleaner-ui.light { --bg: #ffffff; --text: #0f1419; --border: #cfd9de; --card: #f7f9f9; --accent: #1d9bf0; --tab-bg: #eff3f4; }
        #x-cleaner-ui.dark { --bg: #000000; --text: #e7e9ea; --border: #333639; --card: #16181c; --accent: #1d9bf0; --tab-bg: #202327; }
        #x-cleaner-ui.amoled { --bg: #000000; --text: #ffffff; --border: #222; --card: #000; --accent: #1d9bf0; --tab-bg: #111; }

        .ui-header { display: flex; border-bottom: 1px solid var(--border); height: 46px; }
        .ui-tabs { display: flex; flex: 1; }
        .ui-tab { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; cursor: pointer; color: #71767b; }
        .ui-tab.active { color: var(--accent); border-bottom: 3px solid var(--accent); }

        .header-btn { width: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-left: 1px solid var(--border); font-size: 18px; }
        #bubble-view { display: none; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; cursor: move; position: relative; }
        #x-cleaner-ui.minimized #bubble-view { display: flex; }
        #x-cleaner-ui.minimized .ui-header, #x-cleaner-ui.minimized .ui-body { display: none; }
        .bubble-restore { position: absolute; top: -5px; right: -5px; background: var(--accent); color: white; width: 22px; height: 22px; border-radius: 50%; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--bg); }

        .ui-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .speed-tabs { display: flex; background: var(--tab-bg); border-radius: 999px; padding: 4px; gap: 4px; }
        .speed-tab { flex: 1; padding: 8px 0; text-align: center; font-size: 10px; font-weight: 800; cursor: pointer; color: #71767b; border-radius: 999px; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .speed-tab.active { background: var(--bg); color: var(--accent); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }

        .preset-buttons button { width: 100%; padding: 10px; border-radius: 12px; border: 2px solid transparent; font-weight: 800; margin-bottom: 6px; cursor: pointer; background: var(--card); color: var(--text); font-size: 12px; display: flex; justify-content: space-between; align-items: center; }
        .preset-buttons button span { font-size: 9px; opacity: 0.6; pointer-events: none; }
        .preset-buttons button.active.slow { border-color: #1d9bf0; }
        .preset-buttons button.active.normal { border-color: #00ba7c; }
        .preset-buttons button.active.fast { border-color: #f4212e; }

        .ui-btn { padding: 12px; border-radius: 999px; border: none; font-weight: 800; cursor: pointer; background: #1d9bf0; color: #fff; }
        .ui-btn.running { background: #f4212e; }
        .ui-stats { text-align: center; font-size: 11px; color: #71767b; }
    `;
    document.head.appendChild(style);

    const ui = document.createElement('div');
    ui.id = 'x-cleaner-ui';
    ui.className = 'light';
    ui.innerHTML = `
        <div id="bubble-view"><span style="font-size:24px; font-weight:bold;">𝕏</span><div class="bubble-restore" id="restore-btn">＋</div></div>
        <div class="ui-header">
            <div class="ui-tabs">
                <div class="ui-tab active" data-tab="unlike">UNLIKE</div>
                <div class="ui-tab" data-tab="delete">DELETE</div>
                <div class="ui-tab" data-tab="unfollow">FOLLOWS</div>
            </div>
            <div id="theme-btn" class="header-btn">🌗</div>
            <div id="min-btn" class="header-btn">−</div>
            <div id="drag-handle" class="header-btn">⠿</div>
        </div>
        <div class="ui-body">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
                <span>Auto-Stop:</span>
                <input type="number" id="stop-limit" style="width:50px; text-align:center;" value="100">
            </div>
            <div class="speed-tabs">
                <div class="speed-tab active" data-mode="preset">PRESET</div>
                <div class="speed-tab" data-mode="custom">CUSTOM</div>
            </div>
            <div id="preset-panel" class="preset-buttons">
                <button class="slow" data-preset="slow">Slow <span>Safest</span></button>
                <button class="normal active" data-preset="normal">Normal <span>Safe</span></button>
                <button class="fast" data-preset="fast">Fast <span>Risky</span></button>
            </div>
            <div id="custom-panel" style="display:none">
                <div style="display:flex; gap:5px;"><input id="min-input" style="width:100%;" placeholder="Min ms"><input id="max-input" style="width:100%;" placeholder="Max ms"></div>
            </div>
            <div id="unfollow-options" style="display:none; font-size:12px;">
                <label><input type="radio" name="uf-filter" value="all" checked> Everyone</label><br>
                <label><input type="radio" name="uf-filter" value="unverified"> Unverified</label><br>
                <label><input type="radio" name="uf-filter" value="non_followers"> Non-Followers</label>
            </div>
            <button id="start-btn" class="ui-btn">START</button>
            <div class="ui-stats">Processed: <b id="counter">0</b></div>
        </div>
    `;
    document.body.appendChild(ui);

    /* =======================
       EVENTS & DRAG
    ======================== */
    let isDragging = false, offset = { x: 0, y: 0 };
    const onStart = (e) => {
        const target = e.target;
        if (target.id === 'drag-handle' || target.closest('#bubble-view')) {
            isDragging = true;
            const c = e.type.includes('touch') ? e.touches[0] : e;
            offset.x = c.clientX - ui.getBoundingClientRect().left;
            offset.y = c.clientY - ui.getBoundingClientRect().top;
            ui.style.transition = 'none';
        }
    };
    const onMove = (e) => {
        if (!isDragging) return;
        const c = e.type.includes('touch') ? e.touches[0] : e;
        ui.style.left = (c.clientX - offset.x) + 'px';
        ui.style.top = (c.clientY - offset.y) + 'px';
        ui.style.right = 'auto';
    };
    const onEnd = () => { isDragging = false; ui.style.transition = 'width 0.3s, height 0.3s, border-radius 0.3s, left 0.3s'; };

    document.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, .ui-tab, .speed-tab, #theme-btn, #min-btn, #restore-btn');
        if (!target) return;
        
        if (target.id === 'theme-btn') {
            themeIndex = (themeIndex + 1) % themes.length;
            ui.className = isMinimized ? themes[themeIndex] + ' minimized' : themes[themeIndex];
        } else if (target.id === 'min-btn' || target.id === 'restore-btn') {
            isMinimized = !isMinimized;
            if (!isMinimized && ui.getBoundingClientRect().left + 330 > window.innerWidth) ui.style.left = (window.innerWidth - 350) + 'px';
            ui.classList.toggle('minimized', isMinimized);
        } else if (target.classList.contains('ui-tab')) {
            document.querySelectorAll('.ui-tab').forEach(t => t.classList.remove('active'));
            target.classList.add('active');
            currentTab = target.dataset.tab;
            document.getElementById('unfollow-options').style.display = currentTab === 'unfollow' ? 'block' : 'none';
        } else if (target.classList.contains('speed-tab')) {
            document.querySelectorAll('.speed-tab').forEach(t => t.classList.remove('active'));
            target.classList.add('active');
            speedMode = target.dataset.mode;
            document.getElementById('preset-panel').style.display = speedMode === 'preset' ? 'block' : 'none';
            document.getElementById('custom-panel').style.display = speedMode === 'custom' ? 'block' : 'none';
        } else if (target.dataset.preset) {
            document.querySelectorAll('.preset-buttons button').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            [minDelay, maxDelay] = presets[target.dataset.preset];
        } else if (target.id === 'start-btn') {
            isRunning = !isRunning;
            target.innerText = isRunning ? 'STOP' : 'START';
            target.classList.toggle('running', isRunning);
            if (isRunning) performAction();
        }
    });

    /* =======================
       ACTION ENGINE
    ======================== */
    const performAction = async () => {
        if (!isRunning) return;

        const limit = parseInt(document.getElementById('stop-limit').value) || 99999;
        if (actionCount >= limit) {
            isRunning = false;
            document.getElementById('start-btn').innerText = 'START';
            document.getElementById('start-btn').classList.remove('running');
            return;
        }

        if (speedMode === 'custom') {
            minDelay = parseInt(document.getElementById('min-input').value) || 1200;
            maxDelay = parseInt(document.getElementById('max-input').value) || 2400;
        }

        let currentElement = null;

        if (currentTab === 'unlike') {
            const btn = document.querySelector('[data-testid="unlike"]');
            if (btn) {
                currentElement = btn.closest('article');
                btn.click();
                actionCount++;
            }
        } else if (currentTab === 'delete') {
            // Check for Repost (Unretweet) button first
            const unretweetBtn = document.querySelector('[data-testid="unretweet"]');
            
            if (unretweetBtn) {
                currentElement = unretweetBtn.closest('article');
                unretweetBtn.click();
                await new Promise(r => setTimeout(r, 500));
                const confirmUndo = document.querySelector('[data-testid="unretweetConfirm"]');
                if (confirmUndo) {
                    confirmUndo.click();
                    actionCount++;
                }
            } else {
                // If not a repost, check for standard Delete via Caret
                const caret = document.querySelector('[data-testid="caret"]');
                if (caret) {
                    currentElement = caret.closest('article');
                    caret.click(); 
                    await new Promise(r => setTimeout(r, 600));
                    const del = Array.from(document.querySelectorAll('[role="menuitem"]')).find(e => e.innerText.includes('Delete'));
                    if (del) {
                        del.click(); 
                        await new Promise(r => setTimeout(r, 700));
                        const conf = document.querySelector('[data-testid="confirmationSheetConfirm"]');
                        if (conf) { conf.click(); actionCount++; }
                    }
                }
            }
        } else if (currentTab === 'unfollow') {
            const filter = document.querySelector('input[name="uf-filter"]:checked').value;
            const cells = document.querySelectorAll('[data-testid="UserCell"]');
            for (const cell of cells) {
                const btn = cell.querySelector('[data-testid$="-unfollow"]');
                if (!btn) continue;
                if (filter === 'unverified' && cell.querySelector('[data-testid="icon-verified"]')) continue;
                if (filter === 'non_followers' && Array.from(cell.querySelectorAll('span')).some(e => e.innerText.includes('Follows you'))) continue;
                currentElement = cell;
                btn.click(); await new Promise(r => setTimeout(r, 700));
                const conf = document.querySelector('[data-testid="confirmationSheetConfirm"]');
                if (conf) { conf.click(); actionCount++; break; }
            }
        }

        // Precision Scroll
        if (currentElement) {
            const height = currentElement.offsetHeight || 300;
            window.scrollBy({ top: height + 15, behavior: 'smooth' });
        } else {
            window.scrollBy({ top: 500, behavior: 'smooth' });
        }

        document.getElementById('counter').innerText = actionCount;
        const finalDelay = Math.random() * (maxDelay - minDelay) + minDelay;
        setTimeout(() => { if (isRunning) performAction(); }, finalDelay);
    };

})();