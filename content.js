let savedPassword = null;

// This script runs on every page to check if the site should be blurred
async function checkLockStatus() {
    const domain = window.location.hostname;

    try {
        const response = await chrome.runtime.sendMessage({
            action: "checkTabStatus",
            domain: domain
        });

        if (response && response.isLocked) {
            savedPassword = response.data.password;
            applyLock(savedPassword);
        }
    } catch (e) {
        console.error("Tab Locker: Error communicating with background script", e);
    }
}

// Listen for real-time updates from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateBlur") {
        if (message.isLocked) {
            fetchStatusAndLock();
        } else {
            removeLock();
        }
    }
});

async function fetchStatusAndLock() {
    const response = await chrome.runtime.sendMessage({
        action: "checkTabStatus",
        domain: window.location.hostname
    });
    if (response && response.isLocked) {
        applyLock(response.data.password);
    }
}

function applyLock(correctPassword) {
    if (document.getElementById("tab-locker-overlay")) return; // Already locked

    // 1. Disable scrolling and selection on the main page
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.userSelect = "none";

    // 2. Create the Password Overlay
    const overlay = document.createElement('div');
    overlay.id = "tab-locker-overlay";

    // Glassmorphism Aesthetic
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4); 
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        pointer-events: auto;
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        user-select: auto;
    `;

    overlay.innerHTML = `
        <div style="
            background: rgba(255, 255, 255, 0.1); 
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            padding: 40px; 
            border-radius: 24px; 
            text-align: center; 
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5); 
            border: 1px solid rgba(255, 255, 255, 0.2); 
            max-width: 400px; 
            width: 85%;
        ">
            <div style="font-size: 60px; margin-bottom: 15px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));">🔒</div>
            <h2 style="margin: 0 0 10px 0; color: #fff; font-size: 26px; font-weight: 600;">Tab Locked</h2>
            <p style="margin: 0 0 30px 0; color: rgba(255,255,255,0.7); font-size: 16px;">This tab is protected. Enter password to access.</p>

            <input type="password" id="locker-password" placeholder="Password" 
                style="
                    padding: 14px; 
                    width: 100%; 
                    box-sizing: border-box; 
                    border-radius: 12px; 
                    border: 1px solid rgba(255, 255, 255, 0.3); 
                    background: rgba(255, 255, 255, 0.9); 
                    color: #000; 
                    margin-bottom: 20px; 
                    outline: none; 
                    text-align: center; 
                    font-size: 18px;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                ">
            <br>

            <button id="unlock-submit" 
                style="
                    padding: 14px 24px; 
                    background: #58079a; 
                    color: white; 
                    border: none; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    font-weight: bold; 
                    width: 100%; 
                    font-size: 16px; 
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(88, 7, 154, 0.4);
                ">
                Unlock Tab
            </button>

            <p id="error-msg" style="color: #ff4d4d; margin-top: 20px; font-size: 14px; display: none; font-weight: 500;">Incorrect password. Try again.</p>
        </div>
    `;

    document.documentElement.appendChild(overlay);

    const passwordInput = overlay.querySelector('#locker-password');
    const unlockButton = overlay.querySelector('#unlock-submit');
    const errorMessage = overlay.querySelector('#error-msg');

    const tryUnlock = async () => {
        if (passwordInput.value === correctPassword) {
            // Tell background to permanently unlock for this session
            await chrome.runtime.sendMessage({
                action: "unlockTab",
                domain: window.location.hostname
            });
            removeLock();
        } else {
            errorMessage.style.display = "block";
            passwordInput.value = "";
            passwordInput.style.borderColor = "#ff4d4d";
        }
    };

    unlockButton.addEventListener('click', tryUnlock);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });

    // Auto-focus the input
    setTimeout(() => passwordInput.focus(), 100);
}

function removeLock() {
    document.documentElement.style.overflow = "";
    document.documentElement.style.userSelect = "";
    const overlay = document.getElementById("tab-locker-overlay");
    if (overlay) overlay.remove();
}

checkLockStatus();