let currentDomain = null;
let isCurrentlyLocked = false;
let currentTabId = null;

// Get the domain of the current active tab
async function getActiveTabDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.url && !tab.url.startsWith('chrome://')) {
            const url = new URL(tab.url);
            currentDomain = url.hostname;
            currentTabId = tab.id;

            // Send the domain to the background service worker to check status
            const response = await chrome.runtime.sendMessage({
                action: "checkTabStatus",
                domain: currentDomain
            });

            isCurrentlyLocked = response && response.isLocked;
            updateUI(isCurrentlyLocked);

            return currentDomain;
        } else {
            // Not a valid webpage (e.g. chrome://extensions)
            currentDomain = null;
            updateUI(false);
        }
    } catch (error) {
        console.error("Error in getActiveTabDomain:", error);
    }
}

function updateUI(isLocked, specificState = null) {
    const setupstate = document.querySelector('.state1');
    const lockedstate = document.querySelector('.state2');
    const verifystate = document.querySelector('.state3');
    const statusText = document.getElementById('statusText');
    const lockActionContainer = document.getElementById('lockActionContainer');
    
    if (!setupstate || !lockedstate || !verifystate) return;

    // Hide everything first
    setupstate.hidden = true;
    lockedstate.hidden = true;
    verifystate.hidden = true;

    if (specificState === 'verify') {
        verifystate.hidden = false;
        return;
    }

    if (specificState === 'setup') {
        setupstate.hidden = false;
        return;
    }

    // Check if domain is already configured
    if (currentDomain) {
        chrome.storage.local.get([currentDomain], (result) => {
            if (result[currentDomain]) {
                // Configured: Show State 2
                lockedstate.hidden = false;
                
                // If it's already locked, hide the 'Lock Now' button because it's redundant
                if (result[currentDomain].isLocked) {
                    if (lockActionContainer) lockActionContainer.style.display = "none";
                    if (statusText) statusText.innerText = "This tab is currently LOCKED.";
                } else {
                    if (lockActionContainer) lockActionContainer.style.display = "block";
                    if (statusText) statusText.innerText = "Protection is active but tab is currently open.";
                }
            } else {
                // Not configured: Show Setup
                setupstate.hidden = false;
            }
        });
    } else {
        setupstate.hidden = false;
    }
}

// Start Update Password Flow
document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    updateUI(null, 'verify');
});

// Cancel Verification
document.getElementById('cancelVerifyBtn')?.addEventListener('click', () => {
    updateUI(isCurrentlyLocked);
});

// Verify Current Password
document.getElementById('verifyPasswordBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('verifyPasswordInput');
    const attempt = input?.value;

    const response = await chrome.runtime.sendMessage({
        action: "checkTabStatus",
        domain: currentDomain
    });

    if (response && response.data && response.data.password === attempt) {
        if (input) input.value = "";
        updateUI(null, 'setup');
    } else {
        alert("Incorrect current password.");
    }
});

// Lock Button Action (Only locking allowed from popup)
document.getElementById('lockNowBtn')?.addEventListener('click', async () => {
    if (!currentDomain) return;

    isCurrentlyLocked = true;

    const response = await chrome.runtime.sendMessage({
        action: "toggleLock",
        domain: currentDomain,
        isLocked: true
    });

    if (response && response.success) {
        updateUI(true);
        
        // Immediate feedback to content script
        if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, {
                action: "updateBlur",
                isLocked: true
            }).catch(err => console.log("Content script not active"));
        }
    }
});

// Handle password creation
document.getElementById('createPasswordBtn')?.addEventListener('click', async () => {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput?.value;

    if (!password) {
        alert("Please enter a password.");
        return;
    }

    if (currentDomain) {
        const response = await chrome.runtime.sendMessage({
            action: "savePassword",
            domain: currentDomain,
            password: password
        });

        if (response && response.success) {
            isCurrentlyLocked = true;
            updateUI(true);
            
            // Immediately lock the tab
            if (currentTabId) {
                chrome.tabs.sendMessage(currentTabId, {
                    action: "updateBlur",
                    isLocked: true
                }).catch(err => console.log("Content script not detected."));
            }
        }
    }
});

// Initialize when popup opens
getActiveTabDomain();