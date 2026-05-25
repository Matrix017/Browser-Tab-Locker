chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkTabStatus") {
        // Look up the domain in local storage
        chrome.storage.local.get([message.domain], (result) => {
            if (result[message.domain]) {
                // Domain is found in storage (it's locked)
                sendResponse({ isLocked: true, data: result[message.domain] });
            } else {
                // Domain not found (needs setup)
                sendResponse({ isLocked: false });
            }
        });
        return true;
    }

    if (message.action === "savePassword") {
        // Save the domain with its password and locked status
        const storageData = {};
        storageData[message.domain] = {
            password: message.password,
            isLocked: true
        };

        chrome.storage.local.set(storageData, () => {
            console.log(`Saved password for ${message.domain}`);
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === "toggleLock") {
        // Fetch current data, update isLocked, and save back
        chrome.storage.local.get([message.domain], (result) => {
            if (result[message.domain]) {
                const updatedData = { ...result[message.domain], isLocked: message.isLocked };
                const storageData = {};
                storageData[message.domain] = updatedData;

                chrome.storage.local.set(storageData, () => {
                    sendResponse({ success: true });
                });
            }
        });
        return true;
    }

    if (message.action === "unlockTab") {
        // Set isLocked to false permanently in storage
        chrome.storage.local.get([message.domain], (result) => {
            if (result[message.domain]) {
                const updatedData = { ...result[message.domain], isLocked: false };
                const storageData = {};
                storageData[message.domain] = updatedData;
                chrome.storage.local.set(storageData, () => {
                    sendResponse({ success: true });
                });
            }
        });
        return true;
    }

    if (message.action === "disablepassword") {
        chrome.storage.local.get([message.domain], (result) => {
            const domainData = result[message.domain];

            // Verify that domainData exists and the password matches the entered data
            if (domainData && domainData.password === message.data) {
                chrome.storage.local.remove([message.domain], () => {
                    console.log(`Successfully deleted ${message.domain} from storage`);
                    sendResponse({ success: true, deleted: true });
                });
            } else {
                sendResponse({ success: false, error: "Incorrect password or domain not found" });
            }
        });
        return true;
    }
});
