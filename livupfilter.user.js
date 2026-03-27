// ==UserScript==
// @name         LivUp Filter
// @namespace    https://github.com/laerciom1/LivUpFilter
// @version      2026-03-20
// @description  Adds a filter for LivUp website
// @author       Chico
// @match        https://www.livup.com.br/marmitas
// @icon         https://www.google.com/s2/favicons?sz=64&domain=livup.com.br
// @grant        none
// ==/UserScript==

(function () {
    const CARDS_CLASS = '.vxlryn-0.XAMNC';
    const ROOT_CLASS = '#__next';

    const FILTERS = [
        { label: 'Preço', type: 'number', id: 'price', min: -1, max: -1, },
        { label: 'Kcals', type: 'number', id: 'kcal', min: -1, max: -1, },
        { label: 'Proteínas (g)', type: 'number', id: 'prot', min: -1, max: -1, },
        { label: 'Gorduras (g)', type: 'number', id: 'fats', min: -1, max: -1, },
        { label: 'Carboidratos (g)', type: 'number', id: 'carb', min: -1, max: -1, },
        { label: 'Não contém lactose', type: 'boolean', id: 'noLact', value: false },
        { label: 'Não contém glúten', type: 'boolean', id: 'noGlut', value: false },
    ];

    let cardsDB = [];
    let panelComponent;
    let showcaseComponent;
    let showcaseCards = [];
    let currentSort = {
        filterId: null,
        direction: 'asc', // 'asc' | 'desc'
    };

    function initCardsDB() {
        let cardInfo = [];

        const cardsElements = document.querySelectorAll(CARDS_CLASS);

        cardsElements.forEach(element => {
            const pTags = Array.from(element.querySelectorAll('p'));

            const priceLabels = pTags.filter(p => p.textContent.includes('R$'));
            const priceLabel = priceLabels.at(-1);
            const kcalLabel = pTags.find(p => p.textContent.trim() === "KCAL");
            const protLabel = pTags.find(p => p.textContent.trim() === "PROT.");
            const fatsLabel = pTags.find(p => p.textContent.trim() === "GORD.");
            const carbLabel = pTags.find(p => p.textContent.trim() === "CARB.");

            const hasGluten = pTags.find(p => p.textContent.trim() === "contém glúten") != null;
            const hasLac = pTags.find(p => p.textContent.trim() === "contém lactose") != null;
            const unavaiable = pTags.find(p => p.textContent.trim() === "Volta logo") != undefined;

            const priceValue = parseFloat(priceLabel.textContent.replace('R$', '').replace(',', '.'));
            const kcalValue = parseFloat(kcalLabel.previousElementSibling.textContent.replace('g', '').replace(',', '.'));
            const protValue = parseFloat(protLabel.previousElementSibling.textContent.replace('g', '').replace(',', '.'));
            const fatsValue = parseFloat(fatsLabel.previousElementSibling.textContent.replace('g', '').replace(',', '.'));
            const carbValue = parseFloat(carbLabel.previousElementSibling.textContent.replace('g', '').replace(',', '.'));

            cardInfo.push({
                'price': priceValue,
                'kcal': kcalValue,
                'prot': protValue,
                'fats': fatsValue,
                'carb': carbValue,
                'noGlut': !hasGluten,
                'noLact': !hasLac,
                'unavaiable': unavaiable,
                'elementRef': element,
            });
        });
        cardsDB = showcaseCards = cardInfo;
    }

    function initComponents() {
        panelComponent = document.createElement('div');
        panelComponent.id = 'tm-livup-filter-panel';
        panelComponent.innerHTML = getInnerHTML();
        initPanelListeners();

        showcaseComponent = document.createElement('div');
        showcaseComponent.id = 'tm-card-container';

        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        const root = document.querySelector(ROOT_CLASS);
        const body = root.children.length > 4 ? root.children[3] : root.children[2];
        body.removeChild(body.children[0]);
        body.appendChild(panelComponent);
        body.appendChild(showcaseComponent);

        applySort();
    }

    function initPanelListeners() {
        FILTERS.forEach((f) => {
            if (f.type === 'number') {
                panelComponent.querySelector(`#tm-livup-${f.id}-min`)?.addEventListener('input', (e) => {
                    f.min = handleNumericValue(e.target.value);
                    applyFilters();
                });
                panelComponent.querySelector(`#tm-livup-${f.id}-max`)?.addEventListener('input', (e) => {
                    f.max = handleNumericValue(e.target.value);
                    applyFilters();
                });
                panelComponent.querySelector(`#${f.id}-tm-livup-sort-btn`)?.addEventListener('click', (e) => {
                    handleOrderOption(`${f.id}-tm-livup-sort-btn`);
                    applySort();
                });
            }

            if (f.type === 'boolean') {
                panelComponent.querySelector(`#tm-livup-${f.id}`)?.addEventListener('input', (e) => {
                    f.value = e.target.checked;
                    applyFilters();
                })
            }
        })
    }

    function matchFilter(card) {
        var matchFilterRes = FILTERS.some((f) => {
            if (f.type === 'boolean' && f.value && !card[f.id]) return true;
            if (f.type === 'number' && ((f.min != -1 && card[f.id] < f.min) || (f.max != -1 && card[f.id] > f.max))) return true;
            return false;
        });
        return !matchFilterRes;
    }

    function applyFilters() {
        showcaseCards = cardsDB.filter(matchFilter);
        updateShowcase();
    }

    function sortCards(cardA, cardB) {
        if (cardA.unavaiable !== cardB.unavaiable) {
            return cardA.unavaiable ? 1 : -1;
        }

        if (!currentSort.filterId) return 0;

        const attr = currentSort.filterId.split('-')[0];
        const cardAValue = Number(cardA[attr]);
        const cardBValue = Number(cardB[attr]);

        if (Number.isNaN(cardAValue) && Number.isNaN(cardBValue)) return 0;
        if (Number.isNaN(cardAValue)) return 1;
        if (Number.isNaN(cardBValue)) return -1;

        return currentSort.direction === 'asc'
            ? cardAValue - cardBValue
            : cardBValue - cardAValue;
    }

    function applySort() {
        updateShowcase(true);
        updateSortIcons();
    }

    function updateShowcase(shouldSort) {
        showcaseComponent.innerHTML = '';
        if (shouldSort) showcaseCards.sort(sortCards);
        showcaseCards.forEach(c => showcaseComponent.appendChild(c.elementRef));
    }

    function updateSortIcons() {
        panelComponent.querySelectorAll('.tm-livup-sort-btn').forEach(btn => {
            let iconName = 'arrow-up-down';
            if (currentSort.filterId === btn.id) {
                iconName = currentSort.direction === 'asc'
                    ? 'arrow-up-narrow-wide'
                    : 'arrow-down-wide-narrow';
            }
            btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        });
        window.lucide?.createIcons();
    }

    function init() {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lucide@latest';
        script.onload = () => {
            initCardsDB();
            initComponents();
            window.lucide?.createIcons();
        };
        document.head.appendChild(script);
    }

    init();

    function handleNumericValue(value) {
        if (value !== '') {
            return parseInt(value);
        }
        return -1;
    }

    function handleOrderOption(filterId) {
        if (currentSort.filterId !== filterId) {
            currentSort.filterId = filterId;
            currentSort.direction = 'asc';
            return;
        }
        if (currentSort.direction === 'asc') {
            currentSort.direction = 'desc';
            return;
        }
        currentSort.filterId = null;
        currentSort.direction = 'asc';
    }

    function getInnerHTML() {
        return `
<div id="tm-livup-filter-bar">
    <div id="tm-livup-filter-title">
        <strong>Filtros Liv Up</strong>
    </div>

    <div id="tm-livup-filter-row">
        ${FILTERS.filter(f => f.type === 'number').map(f => `
        <div class="tm-livup-inline-group">
            <div class="tm-livup-inline-header">
                <div class="tm-livup-sort-btn" id="${f.id}-tm-livup-sort-btn">
                    <i data-lucide="arrow-up-down"></i>
                </div>
                <span class="tm-livup-inline-label">${f.label}</span>
            </div>
            <div class="tm-livup-inline-inputs">
                <input id="tm-livup-${f.id}-min" type="number" min="0" step="1" placeholder="Min" />
                <input id="tm-livup-${f.id}-max" type="number" min="0" step="1" placeholder="Max" />
            </div>
        </div>
        `).join('')}
        <div class="tm-livup-inline-group tm-livup-inline-group-checkboxes">
            ${FILTERS.filter(f => f.type === 'boolean').map(f => `
            <div class="tm-livup-boolean-item">
                <input type="checkbox" id="tm-livup-${f.id}">
                <span class="tm-livup-inline-label">${f.label}</span>
            </div>
            `).join('')}
        </div>
    </div>
</div>
        `;
    }

    const css = `
#tm-card-container {
    width: 70%;
    margin: 0 auto 32px auto;

    display: grid;
    grid-template-columns: repeat(4, 1fr);
    /* 4 cards por linha */
    gap: 16px;

    justify-content: center;
    /* mantém o grid centralizado */
}

#tm-livup-filter-panel {
    min-width: 1120px;
    max-width: 70%;
    margin: 24px auto;
    background: #ffffff;
    border: 1px solid #d9d9d9;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    font-family: Arial, sans-serif;
    color: #222;
    box-sizing: border-box;
    padding: 16px 20px;
}

#tm-livup-filter-bar {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

#tm-livup-filter-title {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 16px;
}

#tm-livup-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
}

.tm-livup-inline-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 170px;
}

.tm-livup-inline-group-checkboxes {
    justify-content: center;
    min-width: auto;
    gap: 10px;
}

.tm-livup-inline-label {
    font-size: 13px;
    font-weight: 700;
}
    
.tm-livup-boolean-item .tm-livup-inline-label {
    display: flex;
    align-items: center;
    margin: 0;
    line-height: 0.8;
}

.tm-livup-boolean-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    cursor: pointer;
}

.tm-livup-boolean-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    flex: 0 0 16px;
}

.tm-livup-inline-inputs {
    display: flex;
    gap: 8px;
}

.tm-livup-inline-inputs input {
    width: 80px;
    box-sizing: border-box;
    padding: 9px 10px;
    border: 1px solid #ccc;
    border-radius: 8px;
}

.tm-livup-inline-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tm-livup-sort-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    cursor: pointer;
}
    `;
})();