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
    const states = {
        setup: document.querySelector('.state1'),
        locked: document.querySelector('.state2'),
        verify: document.querySelector('.state3'),
        disable: document.querySelector('.state4')
    };

    const statusText = document.getElementById('statusText');
    const lockActionContainer = document.getElementById('lockActionContainer');

    // Hide all states first to prevent overlaps
    Object.values(states).forEach(state => {
        if (state) state.hidden = true;
    });

    if (specificState && states[specificState]) {
        states[specificState].hidden = false;
        return;
    }

    // Default logic based on domain configuration
    if (currentDomain) {
        chrome.storage.local.get([currentDomain], (result) => {
            if (result[currentDomain]) {
                // Configured: Show State 2 (Locked status)
                if (states.locked) states.locked.hidden = false;

                if (result[currentDomain].isLocked) {
                    if (lockActionContainer) lockActionContainer.style.display = "none";
                    if (statusText) statusText.innerText = "This tab is currently LOCKED.";
                } else {
                    if (lockActionContainer) lockActionContainer.style.display = "block";
                    if (statusText) statusText.innerText = "Protection is active but tab is open.";
                }
            } else {
                // Not configured: Show Setup
                if (states.setup) states.setup.hidden = false;
            }
        });
    } else {
        if (states.setup) states.setup.hidden = false;
    }
}

// UI Event Listeners
document.getElementById('changePasswordBtn')?.addEventListener('click', () => updateUI(null, 'verify'));
document.getElementById('cancelVerifyBtn')?.addEventListener('click', () => updateUI(isCurrentlyLocked));
document.getElementById('disable-passwordbtn')?.addEventListener('click', () => updateUI(null, 'disable'));
document.getElementById('cancelDisableBtn')?.addEventListener('click', () => updateUI(isCurrentlyLocked));

// Toggle Password Visibility Logic
document.querySelectorAll('.toggle-password').forEach(span => {
    span.addEventListener('click', () => {
        const inputId = span.getAttribute('data-target');
        const input = document.getElementById(inputId);
        if (input) {
            if (input.type === "password") {
                input.type = "text";
                span.innerText = "🔒"; // Change icon to closed lock or similar
            } else {
                input.type = "password";
                span.innerText = "👁️";
            }
        }
    });
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

// Lock Button Action
document.getElementById('lockNowBtn')?.addEventListener('click', async () => {
    if (!currentDomain) return;
    const response = await chrome.runtime.sendMessage({
        action: "toggleLock",
        domain: currentDomain,
        isLocked: true
    });

    if (response && response.success) {
        isCurrentlyLocked = true;
        updateUI(true);
        if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, { action: "updateBlur", isLocked: true })
                .catch(err => console.log("Content script not active"));
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
            if (currentTabId) {
                chrome.tabs.sendMessage(currentTabId, { action: "updateBlur", isLocked: true })
                    .catch(err => console.log("Content script not detected."));
            }
        }
    }
});

// Disable Security Action
document.getElementById('disable-passwordverification')?.addEventListener('click', async () => {
    const passwordInput = document.getElementById('disable-passwordsinput');
    const disablestatus = document.getElementById('disabling-status');
    const entered_password = passwordInput?.value;
    const domain = await getActiveTabDomain();

    if (entered_password.trim() !== "" && domain) {
        chrome.runtime.sendMessage({ 
            action: 'disablepassword', 
            domain: domain, 
            data: entered_password 
        }, (response) => {
            if (response && response.success) {
                disablestatus.innerText = "Security disabled successfully";
                disablestatus.style.color = "#4caf50";
                disablestatus.hidden = false;
                passwordInput.value = "";
                
                setTimeout(() => {
                    updateUI(false);
                    disablestatus.hidden = true;
                }, 1500);
            } else {
                disablestatus.innerText = "Password is incorrect";
                disablestatus.style.color = "#f44336";
                disablestatus.hidden = false;
            }
        });
    }
});

// Initialize
getActiveTabDomain();
