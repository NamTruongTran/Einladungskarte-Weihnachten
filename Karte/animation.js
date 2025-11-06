
(function() {
    'use strict';

    const API_BASE = 'https://jbin.ylo.one/api.php';
    const PUBLIC_BIN_ID = 'f91d8e054c5d295cd148d89e9296139a';

    const timeScale = 1.5;

    function scaledTime(ms) {
        return Math.round(ms / timeScale);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    async function init() {
        const stage = document.getElementById('stage');
        const loader = document.getElementById('loader');

        try {
            if (loader) loader.style.display = 'flex';

            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');

            if (!code) {
                throw new Error('No code provided in URL');
            }

            const response = await fetch(`${API_BASE}/bins/${PUBLIC_BIN_ID}`);
            if (!response.ok) {
                throw new Error('Failed to load card data');
            }

            const result = await response.json();
            const data = result.data;

            if (!data) {
                throw new Error('No data found');
            }

            console.log('Looking for code:', code);
            console.log('Available friends:', data.friends);

            const friend = data.friends.find(f => String(f.code) === String(code));

            if (!friend) {
                console.error('Code not found. Available codes:', data.friends.map(f => f.code));
                throw new Error(`Invalid code: ${code}`);
            }

            console.log('Found friend:', friend);

            await applyPersonalization(data.globalSettings, friend);

            if (loader) loader.style.display = 'none';

            stage.classList.remove('loading');

            startAnimation();

        } catch (error) {
            console.error('Error loading card:', error);
            if (loader) {
                loader.innerHTML = `<p style="color: white;">Error: ${error.message}</p>`;
            }
        }
    }

    function generateColorShades(baseColor) {
        const hex = baseColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        const lighten = (amount) => {
            const nr = Math.min(255, Math.floor(r + (255 - r) * amount));
            const ng = Math.min(255, Math.floor(g + (255 - g) * amount));
            const nb = Math.min(255, Math.floor(b + (255 - b) * amount));
            return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
        };

        const darken = (amount) => {
            const nr = Math.floor(r * (1 - amount));
            const ng = Math.floor(g * (1 - amount));
            const nb = Math.floor(b * (1 - amount));
            return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
        };

        return {
            lightest: lighten(0.15),    
            light: lighten(0.05),        
            base: baseColor,             
            medium: darken(0.1),         
            dark: darken(0.2)            
        };
    }

    async function loadAndColorSVG(svgPath, colorReplacements) {
        const response = await fetch(svgPath);
        let svgContent = await response.text();

        for (const [oldColor, newColor] of Object.entries(colorReplacements)) {
            const regex = new RegExp(oldColor, 'gi');
            svgContent = svgContent.replace(regex, newColor);
        }

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    }

    async function applyPersonalization(globalSettings, friend) {
        const senderName = document.querySelector('.sender-name');
        if (senderName && globalSettings.senderName) {
            senderName.textContent = globalSettings.senderName;
        }

        const receiverName = document.querySelector('.receiver-name');
        if (receiverName && friend.name) {
            receiverName.textContent = friend.name;
        }

        const cardSender = document.querySelector('.card-sender');
        if (cardSender && globalSettings.senderName) {
            cardSender.textContent = globalSettings.senderName;
        }

        const cardMessage = document.querySelector('.card-message');
        if (cardMessage) {
            const message = friend.customFrontMessage || globalSettings.cardFrontMessage || 'Wishing you a wonderful Christmas!';
            cardMessage.textContent = message;
        }

        const cardBackContent = document.querySelector('.card-back-content');
        if (cardBackContent) {
            const message = friend.customBackMessage || globalSettings.cardBackMessage || 'I wish you all the best for the future.';
            const formattedMessage = message.replace(/\n/g, '<br>');
            cardBackContent.innerHTML = `<p>${formattedMessage}</p>`;
        }

        const envelopeColor = friend.envelopeColor || globalSettings.envelopeColor;
        if (envelopeColor) {
            const shades = generateColorShades(envelopeColor);

            const frontColorMap = {
                '#F0DDC0': shades.lightest,
                '#E7CDA8': shades.light,
                '#D5BC96': shades.medium,
                '#C8AF88': shades.dark
            };
            const frontSvgUrl = await loadAndColorSVG('images/envelope_front.svg', frontColorMap);
            document.querySelector('.envelope_front').style.backgroundImage = `url('${frontSvgUrl}')`;

            const backColorMap = {
                '#DFC49F': shades.light,     
                '#D5BC96': shades.medium,    
                '#E7CDA8': shades.base       
            };
            const backSvgUrl = await loadAndColorSVG('images/envelope_back.svg', backColorMap);
            document.querySelector('.envelope_back_outside').style.backgroundImage = `url('${backSvgUrl}')`;

            const flapClosedColorMap = {
                '#D5BC96': shades.medium     
            };
            const flapClosedUrl = await loadAndColorSVG('images/flap_closed.svg', flapClosedColorMap);
            document.querySelector('.flap_outside').style.backgroundImage = `url('${flapClosedUrl}')`;

            const flapOpenedColorMap = {
                '#CEB38B': shades.medium,    
                '#efefef': shades.lightest   
            };
            const flapOpenedUrl = await loadAndColorSVG('images/flap_opened.svg', flapOpenedColorMap);
            document.querySelector('.flap_inside').style.backgroundImage = `url('${flapOpenedUrl}')`;

        }

        const envelopeTextColor = friend.envelopeTextColor || globalSettings.envelopeTextColor;
        if (envelopeTextColor) {
            const stampColorMap = {
                'fill="[^"]*"': `fill="${envelopeTextColor}"`
            };
            loadAndColorSVG('images/stamp.svg', stampColorMap).then(stampUrl => {
                const stampImg = document.querySelector('.stamp');
                if (stampImg) {
                    stampImg.src = stampUrl;
                }
            });

            const senderNameEl = document.querySelector('.sender-name');
            if (senderNameEl) {
                senderNameEl.style.color = envelopeTextColor;
            }

            const receiverNameEl = document.querySelector('.receiver-name');
            if (receiverNameEl) {
                receiverNameEl.style.color = envelopeTextColor;
            }
        }

        const titleColor = friend.titleColor || globalSettings.titleColor;
        if (titleColor) {
            const cardTitle = document.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.style.color = titleColor;
            }
        }

        const imageUrl = friend.customImageUrl || globalSettings.globalImageUrl;
        if (imageUrl) {
            const imagePlaceholder = document.querySelector('.card-image-placeholder');
            if (imagePlaceholder) {
                let img = imagePlaceholder.querySelector('.custom-card-image');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'custom-card-image';
                    imagePlaceholder.appendChild(img);
                }
                img.src = imageUrl;
            }
        }
    }

    function startAnimation() {
        const envelope = document.querySelector('.envelope');

        setTimeout(() => {
            envelope.classList.add('slideIn');
            console.log('Step 1: Envelope sliding in to center');
        }, scaledTime(100));

        setTimeout(() => {
            console.log('Step 2: Starting flip sequence');

            envelope.classList.add('flip');

            setTimeout(() => {
                envelope.classList.add('movedDown');
                console.log('Step 2: Envelope flipped and moved down');
            }, scaledTime(2500));
        }, scaledTime(3500)); 

        setTimeout(() => {
            console.log('Step 3: Opening envelope');
            envelope.classList.remove('closed');
        }, scaledTime(7000)); 

        setTimeout(() => {
            console.log('Step 4: Card sliding out');
            envelope.classList.add('cardRemoved');
        }, scaledTime(8500)); 

        setTimeout(() => {
            console.log('Step 5: Envelope dismissing');
            envelope.classList.add('dismissed');
        }, scaledTime(9900)); 

        setTimeout(() => {
            console.log('Step 6: Card zooming');
            const card = document.querySelector('.card');
            card.classList.add('zoomed');
        }, scaledTime(11100)); 

        setTimeout(() => {
            console.log('Step 7: Card flipping to show back');
            const card = document.querySelector('.card');
            card.classList.add('flipped');
        }, scaledTime(14300)); 

        setTimeout(() => {
            console.log('Animation complete!');
            window.animationFinished = true;
        }, scaledTime(15300)); 
    }

    function onTransitionEnd(element, callback) {
        const events = ['transitionend', 'webkitTransitionEnd', 'oTransitionEnd', 'MSTransitionEnd'];

        function handler(e) {
            events.forEach(event => {
                element.removeEventListener(event, handler);
            });
            callback(e);
        }

        events.forEach(event => {
            element.addEventListener(event, handler);
        });
    }

    window.restartAnimation = function() {
        location.reload();
    };

    window.getTimeScale = function() {
        return timeScale;
    };

})();
