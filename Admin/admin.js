const API_BASE = 'https://jbin.ylo.one/api.php';

let appState = {
    apiKey: 'b82cb56a5bc1c3271d8e9ae3a38c2ff9a6ee5ef3f310b2ede906b615f27894cb',
    privateBinId: '08cfaee0aedb43d0993ecd6696f8e918',
    publicBinId: 'f91d8e054c5d295cd148d89e9296139a',
    globalSettings: {
        senderName: 'Andrew Reinert',
        cardFrontMessage: 'Wishing you a wonderful Christmas!',
        cardBackMessage: 'I wish you all the best for the future. May this holiday season bring you joy and happiness.',
        envelopeColor: '#E7CDA8',
        envelopeTextColor: '#5a4a3a',
        titleColor: '#2c5f2d',
        globalImageUrl: ''
    },
    friends: []
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    document.getElementById('addFriendBtn').addEventListener('click', openAddFriendModal);
    document.getElementById('saveFriendBtn').addEventListener('click', saveFriend);

    document.getElementById('friendCustomCard').addEventListener('change', (e) => {
        document.getElementById('friendImageUrl').style.display = e.target.checked ? 'block' : 'none';
    });

    ['senderName', 'cardFrontMessage', 'cardBackMessage', 'envelopeColor', 'envelopeTextColor', 'titleColor', 'globalImageUrl'].forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('change', autoSave);
        element.addEventListener('blur', autoSave);
    });

    loadData();
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (window.innerWidth <= 768) {
        toggleMobileMenu();
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

async function makeApiRequest(endpoint, method = 'GET', data = null, requireAuth = true) {
    const apiKey = appState.apiKey.trim();

    if (!apiKey && requireAuth) {
        showNotification('API key not configured', 'error');
        return null;
    }

    const url = `${API_BASE}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (apiKey && requireAuth) {
        options.headers['X-API-Key'] = apiKey;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        updateStatusIndicator('loading');
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        updateStatusIndicator('connected');

        return result;
    } catch (error) {
        console.error('API Request Failed:', error);
        updateStatusIndicator('error');
        showNotification(`Error: ${error.message}`, 'error');
        return null;
    }
}

async function loadData() {
    const binId = appState.privateBinId;

    if (!binId) {
        return;
    }

    updateStatusIndicator('loading');
    const result = await makeApiRequest(`/bins/${binId}`, 'GET');

    if (result && result.data) {
        if (result.data.globalSettings) {
            appState.globalSettings = { ...appState.globalSettings, ...result.data.globalSettings };
        }

        if (result.data.friends) {
            // const baseUrl = window.location.origin + window.location.pathname.replace(/admin-[^\/]+\/.*$/, 'card/index.html');
            const baseUrl = window.location.origin + window.location.pathname.replace(/Admin\/.*$/, 'Karte/index.html');
            let needsAutoSave = false;

            appState.friends = result.data.friends.map(friend => {
                if (!friend.code) {
                    friend.code = generateUniqueCode();
                    console.log(`Generated code ${friend.code} for ${friend.name}`);
                    needsAutoSave = true;
                }

                if (!friend.emailHTML) {
                    const url = `${baseUrl}?code=${friend.code}`;
                    const envelopeColor = friend.envelopeColor || appState.globalSettings.envelopeColor;
                    const envelopeTextColor = friend.envelopeTextColor || appState.globalSettings.envelopeTextColor;
                    friend.emailHTML = createEmailTemplate(friend.name, url, appState.globalSettings.senderName, envelopeColor, envelopeTextColor);
                    console.log(`Generated email template for ${friend.name}`);
                    needsAutoSave = true;
                }

                return friend;
            });

            if (needsAutoSave) {
                autoSave();
            }
        }

        updateUI();
        updateStatusIndicator('connected');
    } else {
        updateStatusIndicator('error');
    }
}

async function autoSave() {
    const privateBinId = appState.privateBinId;
    const publicBinId = appState.publicBinId;

    if (!privateBinId || !publicBinId) {
        return;
    }

    collectGlobalSettings();

    updateStatusIndicator('loading');

    const privatePayload = {
        data: {
            globalSettings: appState.globalSettings,
            friends: appState.friends,
            lastUpdated: new Date().toISOString()
        },
        is_public: false
    };

    const publicFriends = appState.friends.map(friend => ({
        name: friend.name,
        code: friend.code,
        customFrontMessage: friend.customFrontMessage,
        customBackMessage: friend.customBackMessage,
        envelopeColor: friend.envelopeColor,
        envelopeTextColor: friend.envelopeTextColor,
        titleColor: friend.titleColor,
        customImageUrl: friend.customImageUrl,
        emailHTML: friend.emailHTML
    }));

    const publicPayload = {
        data: {
            globalSettings: appState.globalSettings,
            friends: publicFriends,
            lastUpdated: new Date().toISOString()
        },
        is_public: true
    };

    const [privateResult, publicResult] = await Promise.all([
        makeApiRequest(`/bins/${privateBinId}`, 'PUT', privatePayload),
        makeApiRequest(`/bins/${publicBinId}`, 'PUT', publicPayload)
    ]);

    if (privateResult && publicResult) {
        updateStatusIndicator('connected');
    } else {
        updateStatusIndicator('error');
    }
}

function updateUI() {
    document.getElementById('senderName').value = appState.globalSettings.senderName;
    document.getElementById('cardFrontMessage').value = appState.globalSettings.cardFrontMessage || '';
    document.getElementById('cardBackMessage').value = appState.globalSettings.cardBackMessage || '';
    document.getElementById('envelopeColor').value = appState.globalSettings.envelopeColor;
    document.getElementById('envelopeTextColor').value = appState.globalSettings.envelopeTextColor || '#5a4a3a';
    document.getElementById('titleColor').value = appState.globalSettings.titleColor;
    document.getElementById('globalImageUrl').value = appState.globalSettings.globalImageUrl || '';

    renderFriendsList();

    renderLinksList();

    renderEmailTemplates();
}

function collectGlobalSettings() {
    appState.globalSettings = {
        senderName: document.getElementById('senderName').value,
        cardFrontMessage: document.getElementById('cardFrontMessage').value,
        cardBackMessage: document.getElementById('cardBackMessage').value,
        envelopeColor: document.getElementById('envelopeColor').value,
        envelopeTextColor: document.getElementById('envelopeTextColor').value,
        titleColor: document.getElementById('titleColor').value,
        globalImageUrl: document.getElementById('globalImageUrl').value
    };
}

function renderFriendsList() {
    const container = document.getElementById('friendsList');
    const emptyState = document.getElementById('emptyState');

    if (appState.friends.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';

    container.innerHTML = appState.friends.map((friend, index) => `
        <div class="friend-item">
            <div class="friend-info">
                <div class="friend-name">${escapeHtml(friend.name)} <span class="friend-code">#${friend.code || '????'}</span></div>
                <div class="friend-details">
                    ${friend.email ? `<span>📧 ${escapeHtml(friend.email)}</span>` : ''}
                    <span>🎨 <span class="color-preview" style="background-color: ${friend.envelopeColor || appState.globalSettings.envelopeColor}"></span></span>
                    ${friend.customFrontMessage || friend.customBackMessage ? '<span>✉️ Custom messages</span>' : ''}
                </div>
            </div>
            <div class="friend-actions">
                <button class="btn btn-secondary" onclick="editFriend(${index})">✏️ Edit</button>
                <button class="btn btn-danger" onclick="deleteFriend(${index})">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

function renderLinksList() {
    const container = document.getElementById('linksList');
    //const baseUrl = window.location.origin + window.location.pathname.replace(/admin-[^\/]+\/.*$/, 'card/index.html');
    const baseUrl = window.location.origin + window.location.pathname.replace(/Admin\/.*$/, 'Karte/index.html');

    if (appState.friends.length === 0) {
        container.innerHTML = '<p class="empty-state">No friends added yet. Add friends to generate links.</p>';
        return;
    }

    container.innerHTML = appState.friends.map((friend, index) => {
        const code = friend.code || generateUniqueCode();
        const url = `${baseUrl}?code=${code}`;

        return `
            <div class="link-item">
                <div class="link-info">
                    <div class="link-name">${escapeHtml(friend.name)} <span class="friend-code">#${code}</span></div>
                    <div class="link-url" title="${url}">...?code=${code}</div>
                </div>
                <div class="link-actions">
                    <button class="btn btn-outline btn-sm" onclick="copyLink('${url}')">📋 Copy</button>
                    <button class="btn btn-primary btn-sm" onclick="openCardPreview('${url}')">👁️ Preview</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderEmailTemplates() {
    const container = document.getElementById('emailTemplatesList');
    const baseUrl = window.location.origin + window.location.pathname.replace(/Admin\/.*$/, 'Karte/index.html');

    if (appState.friends.length === 0) {
        container.innerHTML = '<p class="empty-state">No friends added yet. Add friends to generate email templates.</p>';
        return;
    }

    container.innerHTML = appState.friends.map((friend, index) => {
        const code = friend.code || generateUniqueCode();
        const url = `${baseUrl}?code=${code}`;

        const envelopeColor = friend.envelopeColor || appState.globalSettings.envelopeColor;
        const envelopeTextColor = friend.envelopeTextColor || appState.globalSettings.envelopeTextColor;
        const emailHTML = createEmailTemplate(friend.name, url, appState.globalSettings.senderName, envelopeColor, envelopeTextColor);

        return `
            <div class="email-template-item">
                <div class="email-template-header" onclick="toggleEmailAccordion(${index})">
                    <h3>${escapeHtml(friend.name)} <span class="friend-code">#${friend.code || '????'}</span></h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); copyEmailTemplate(${index})">📋 Copy Email</button>
                        <span class="accordion-icon">▼</span>
                    </div>
                </div>
                <div class="email-template-content" id="emailContent${index}" style="display: none;">
                    <div class="form-group">
                        <label style="font-weight: 600; margin-bottom: 8px; display: block;">✏️ Click anywhere below to edit the email content:</label>
                        <div id="emailEditor${index}" contenteditable="true" class="contenteditable-email" style="width: 100%; min-height: 400px; border: 2px solid var(--border); border-radius: 8px; padding: 20px; background: white; overflow: auto; max-height: 600px;" onblur="saveEmailTemplate(${index})">${friend.emailHTML || emailHTML}</div>
                        <small style="display: block; margin-top: 8px; color: var(--text-light);">💡 Tip: You can edit text, change colors, modify the message - just click and type!</small>
                    </div>
                    <div style="margin-top: 12px;">
                        <button class="btn btn-outline btn-sm" onclick="resetEmailTemplate(${index})">🔄 Reset to Default</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function createEmailTemplate(recipientName, cardUrl, senderName, envelopeColor = '#E7CDA8', envelopeTextColor = '#5a4a3a') {
    const darkerColor = envelopeColor.replace('#', '');
    const r = parseInt(darkerColor.substr(0, 2), 16);
    const g = parseInt(darkerColor.substr(2, 2), 16);
    const b = parseInt(darkerColor.substr(4, 2), 16);
    const darkerShade = `#${Math.floor(r * 0.8).toString(16).padStart(2, '0')}${Math.floor(g * 0.8).toString(16).padStart(2, '0')}${Math.floor(b * 0.8).toString(16).padStart(2, '0')}`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Merry Christmas from ${senderName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, ${envelopeColor} 0%, ${darkerShade} 100%); border-radius: 8px 8px 0 0;">
                            <p style="margin: 0 0 12px 0; font-size: 14px; color: ${envelopeTextColor}; opacity: 0.8; font-family: 'Dancing Script', cursive;">From: ${senderName}</p>
                            <h1 style="margin: 0; color: ${envelopeTextColor}; font-size: 32px; font-family: Georgia, 'Times New Roman', serif;">🎄 Merry Christmas! 🎄</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.6; color: #333333;">Hi ${recipientName},</p>

                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #555555;">
                                Wishing you a wonderful Christmas and a happy New Year! I hope this holiday season brings you lots of joy and happiness.
                            </p>

                            <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #555555;">
                                Click below to view your card:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 0 0 20px; text-align: center;">
                                        <a href="${cardUrl}" style="display: inline-block; padding: 16px 40px; background-color: ${envelopeColor}; color: ${envelopeTextColor}; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);">
                                            🎁 View Card
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0; font-size: 14px; color: #888888;">
                                Warm wishes,<br>
                                <strong style="font-size: 16px;">${senderName}</strong>
                            </p>
                            <p style="margin: 15px 0 0; font-size: 12px; color: #aaaaaa;">
                                🎅 Happy Holidays! 🎄
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function toggleEmailAccordion(index) {
    const content = document.getElementById(`emailContent${index}`);
    const header = content.previousElementSibling;
    const icon = header.querySelector('.accordion-icon');
    const isOpen = content.style.display === 'block';

    document.querySelectorAll('.email-template-content').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.accordion-icon').forEach(el => {
        el.textContent = '▼';
    });
    document.querySelectorAll('.email-template-item').forEach(el => {
        el.classList.remove('active');
    });

    if (!isOpen) {
        content.style.display = 'block';
        icon.textContent = '▲';
        header.parentElement.classList.add('active');
    }
}

function saveEmailTemplate(index) {
    const editor = document.getElementById(`emailEditor${index}`);
    const htmlContent = editor.innerHTML;

    appState.friends[index].emailHTML = htmlContent;

    autoSave();
}

function resetEmailTemplate(index) {
    const friend = appState.friends[index];
    //const baseUrl = window.location.origin + window.location.pathname.replace(/admin-[^\/]+\/.*$/, 'card/index.html');
    const baseUrl = window.location.origin + window.location.pathname.replace(/Admin\/.*$/, 'Karte/index.html');
    const code = friend.code || generateUniqueCode();
    const url = `${baseUrl}?code=${code}`;

    const envelopeColor = friend.envelopeColor || appState.globalSettings.envelopeColor;
    const envelopeTextColor = friend.envelopeTextColor || appState.globalSettings.envelopeTextColor;
    const defaultHTML = createEmailTemplate(friend.name, url, appState.globalSettings.senderName, envelopeColor, envelopeTextColor);

    const editor = document.getElementById(`emailEditor${index}`);
    editor.innerHTML = defaultHTML;

    appState.friends[index].emailHTML = defaultHTML;

    autoSave();

    showNotification('Email template reset to default', 'success');
}

function copyEmailTemplate(index) {
    const editor = document.getElementById(`emailEditor${index}`);

    const range = document.createRange();
    range.selectNodeContents(editor);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        document.execCommand('copy');
        showNotification('Email copied! You can now paste it into your email client.', 'success');
    } catch (err) {
        showNotification('Failed to copy email. Please try selecting and copying manually.', 'error');
    }

    selection.removeAllRanges();
}

function openAddFriendModal() {
    document.getElementById('modalTitle').textContent = 'Add Friend';
    document.getElementById('editFriendIndex').value = '';
    document.getElementById('friendName').value = '';
    document.getElementById('friendEmail').value = '';
    document.getElementById('friendFrontMessage').value = '';
    document.getElementById('friendBackMessage').value = '';
    document.getElementById('friendEnvelopeColor').value = appState.globalSettings.envelopeColor;
    document.getElementById('friendEnvelopeTextColor').value = appState.globalSettings.envelopeTextColor;
    document.getElementById('friendTitleColor').value = appState.globalSettings.titleColor;
    document.getElementById('friendCustomCard').checked = false;
    document.getElementById('friendImageUrl').value = '';
    document.getElementById('friendImageUrl').style.display = 'none';

    document.getElementById('friendModal').classList.add('active');
}

function editFriend(index) {
    const friend = appState.friends[index];

    document.getElementById('modalTitle').textContent = 'Edit Friend';
    document.getElementById('editFriendIndex').value = index;
    document.getElementById('friendName').value = friend.name;
    document.getElementById('friendEmail').value = friend.email || '';
    document.getElementById('friendFrontMessage').value = friend.customFrontMessage || '';
    document.getElementById('friendBackMessage').value = friend.customBackMessage || '';
    document.getElementById('friendEnvelopeColor').value = friend.envelopeColor || appState.globalSettings.envelopeColor;
    document.getElementById('friendEnvelopeTextColor').value = friend.envelopeTextColor || appState.globalSettings.envelopeTextColor;
    document.getElementById('friendTitleColor').value = friend.titleColor || appState.globalSettings.titleColor;
    document.getElementById('friendCustomCard').checked = !!friend.customImageUrl;
    document.getElementById('friendImageUrl').value = friend.customImageUrl || '';
    document.getElementById('friendImageUrl').style.display = friend.customImageUrl ? 'block' : 'none';

    document.getElementById('friendModal').classList.add('active');
}

function saveFriend() {
    const name = document.getElementById('friendName').value.trim();

    if (!name) {
        return;
    }

    const editIndex = document.getElementById('editFriendIndex').value;

    const friendData = {
        name,
        email: document.getElementById('friendEmail').value.trim(),
        customFrontMessage: document.getElementById('friendFrontMessage').value.trim(),
        customBackMessage: document.getElementById('friendBackMessage').value.trim(),
        envelopeColor: document.getElementById('friendEnvelopeColor').value,
        envelopeTextColor: document.getElementById('friendEnvelopeTextColor').value,
        titleColor: document.getElementById('friendTitleColor').value,
        customImageUrl: document.getElementById('friendCustomCard').checked ?
            document.getElementById('friendImageUrl').value.trim() : ''
    };

    if (editIndex === '') {
        friendData.code = generateUniqueCode();

        //const baseUrl = window.location.origin + window.location.pathname.replace(/admin-[^\/]+\/.*$/, 'card/index.html');
        const baseUrl = window.location.origin + window.location.pathname.replace(/Admin\/.*$/, 'Karte/index.html');
        const url = `${baseUrl}?code=${friendData.code}`;
        friendData.emailHTML = createEmailTemplate(friendData.name, url, appState.globalSettings.senderName, friendData.envelopeColor, friendData.envelopeTextColor);

        appState.friends.push(friendData);
    } else {
        const existingFriend = appState.friends[parseInt(editIndex)];
        friendData.code = existingFriend.code || generateUniqueCode();
        friendData.emailHTML = existingFriend.emailHTML;
        appState.friends[parseInt(editIndex)] = friendData;
    }

    closeFriendModal();
    updateUI();
    autoSave();
}

function deleteFriend(index) {
    if (confirm(`Delete ${appState.friends[index].name}?`)) {
        appState.friends.splice(index, 1);
        updateUI();
        autoSave();
    }
}

function closeFriendModal() {
    document.getElementById('friendModal').classList.remove('active');
}

function openCardPreview(url) {
    const modal = document.getElementById('cardPreviewModal');
    const iframe = document.getElementById('cardPreviewFrame');
    iframe.src = url;
    modal.classList.add('active');

    document.addEventListener('keydown', handlePreviewEscape);
}

function closeCardPreview() {
    const modal = document.getElementById('cardPreviewModal');
    const iframe = document.getElementById('cardPreviewFrame');
    iframe.src = '';
    modal.classList.remove('active');

    document.removeEventListener('keydown', handlePreviewEscape);
}

function handlePreviewEscape(e) {
    if (e.key === 'Escape') {
        closeCardPreview();
    }
}

function updateStatusIndicator(status) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    indicator.className = 'status-indicator';

    if (status === 'loading') {
        statusText.textContent = 'Saving...';
    } else if (status === 'connected') {
        indicator.classList.add('connected');
        statusText.textContent = 'Saved';
    } else if (status === 'error') {
        indicator.classList.add('error');
        statusText.textContent = 'Error';
    }
}

function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showNotification('Link copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy link', 'error');
    });
}

function generateFriendId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateUniqueCode() {
    let code;
    let attempts = 0;
    const maxAttempts = 100;

    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
    } while (appState.friends.some(f => f.code === code) && attempts < maxAttempts);

    return code;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeFriendModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeFriendModal();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveData();
    }
});
