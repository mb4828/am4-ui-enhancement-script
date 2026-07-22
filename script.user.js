// ==UserScript==
// @name         AM4 UI Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Usability and Immersion improvements for Airline Manager 4
// @author       matt@mattbrauner.com & Haruko
// @match        https://www.airlinemanager.com/*
// @icon         https://www.airlinemanager.com/favicon.ico
// @homepage     https://github.com/mb4828/am4-ui-enhancement-script
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

'use strict';

const startupSound = new Audio(
  'https://raw.githubusercontent.com/mb4828/am4-ui-enhancement-script/main/sounds/ding-long.mp3'
);
const notificationSound = new Audio(
  'https://raw.githubusercontent.com/mb4828/am4-ui-enhancement-script/main/sounds/ding-short.mp3'
);
const takeoffSound = new Audio(
  'https://raw.githubusercontent.com/mb4828/am4-ui-enhancement-script/main/sounds/takeoff.mp3'
);
startupSound.volume = 0.1;
notificationSound.volume = 0.1;
takeoffSound.volume = 0.4;

const RESOURCE_PRICE_SCHEDULE_URL =
  'https://raw.githubusercontent.com/theheuman/am4-helper/main/resource-prices.json';
const RESOURCE_MARKET_MODAL_ID = 'am4-resource-market-modal';
const RESOURCE_MARKET_RESOURCES = ['fuel', 'co2'];
const RESOURCE_PRICE_ALERTS = {
  enabled: true,
  fuelThreshold: 550,
  co2Threshold: 130,
};
const RESOURCE_ALERT_SETTINGS_KEY = 'am4-resource-alert-settings';
let resourcePricesPromise = null;
let resourcePricesData = null;

/** Hide game ads */
function hideGameAds() {
  const gameAd = document.getElementById('game-ad');
  const skyHaven = document.getElementById('skyhaven');
  if (gameAd) {
    gameAd.style.display = 'none';
  }
  if (skyHaven) {
    skyHaven.style.display = 'none';
  }
}

/** Better auto price */
function getBetterAutoPriceDetails(cmd) {
  if (!cmd) return null;

  const callMatch = cmd.match(/\b(ticketPriceSuggest|autoPrice)\s*\(([^)]*)\)/);
  if (!callMatch) return null;

  const args = callMatch[2].split(',').map((arg) => arg.trim());
  if (args.length < 3) return null;

  const multipliers = [1.1, 1.08, 1.06];
  const originalPrices = [];
  const betterPrices = [];
  for (let i = 0; i < multipliers.length; i++) {
    const value = Number(args[i]);
    if (!Number.isFinite(value)) return null;
    originalPrices.push(value);
    betterPrices.push(Math.ceil(value * multipliers[i]) - 1);
    args[i] = String(betterPrices[i]);
  }

  const start = callMatch.index;
  const end = start + callMatch[0].length;
  return {
    originalPrices,
    betterPrices,
    updatedOnclick: `${cmd.slice(0, start)}${callMatch[1]}(${args.join(',')})${cmd.slice(end)}`,
  };
}

function formatAutoPriceValues(prices) {
  return prices.map((price) => price.toLocaleString()).join(' / ');
}

function getAutoPriceInputs(button) {
  const container =
    button.closest('.modal, form, .row, .container, .card, body') || document.body;
  const inputs = Array.from(container.querySelectorAll('input'))
    .filter((input) => {
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'number', 'tel'].includes(type) && !input.disabled && input.offsetParent !== null;
    });
  const cabinInputs = ['economy', 'business', 'first']
    .map((cabin) =>
      inputs.find((input) =>
        ['placeholder', 'name', 'id', 'aria-label'].some((attr) =>
          (input.getAttribute(attr) || '').toLowerCase().includes(cabin)
        )
      )
    )
    .filter(Boolean);

  return cabinInputs.length === 3 ? cabinInputs : inputs.slice(0, 3);
}

function applyAutoPriceValues(button, prices) {
  getAutoPriceInputs(button).forEach((input, index) => {
    if (!Number.isFinite(prices[index])) return;
    input.value = prices[index];
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function addBetterAutoPriceComparison(button, originalPrices, betterPrices) {
  if (button.dataset.hasBetterAutoPriceComparison) return;

  const comparison = document.createElement('div');
  comparison.className = 'am4-better-auto-price-comparison';
  comparison.style.cssText = [
    'display:block',
    'width:100%',
    'max-width:100%',
    'box-sizing:border-box',
    'clear:both',
    'margin:6px 0 0',
    'padding:6px 8px',
    'border:1px solid #d7e3f0',
    'border-radius:6px',
    'background:#f8fbff',
    'color:#43505f',
    'font-size:11px',
    'line-height:1.35',
    'text-align:left',
    'white-space:normal',
  ].join(';');
  comparison.dataset.originalPrices = JSON.stringify(originalPrices);
  comparison.dataset.betterPrices = JSON.stringify(betterPrices);
  comparison.innerHTML = `
    <div><strong>E:</strong> ${originalPrices[0].toLocaleString()} -> ${betterPrices[0].toLocaleString()}</div>
    <div><strong>B:</strong> ${originalPrices[1].toLocaleString()} -> ${betterPrices[1].toLocaleString()}</div>
    <div><strong>F:</strong> ${originalPrices[2].toLocaleString()} -> ${betterPrices[2].toLocaleString()}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;">
      <button type="button" class="am4-use-original-price">Original</button>
      <button type="button" class="am4-use-better-price">Better</button>
    </div>
  `;
  comparison.querySelectorAll('button').forEach((control) => {
    control.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-width:64px',
      'height:24px',
      'padding:2px 8px',
      'border:1px solid #9db7d4',
      'border-radius:4px',
      'background:#ffffff',
      'color:#2466a8',
      'font-size:11px',
      'line-height:1',
      'cursor:pointer',
    ].join(';');
  });
  comparison.querySelector('.am4-use-original-price').addEventListener('click', () => {
    applyAutoPriceValues(button, JSON.parse(comparison.dataset.originalPrices || '[]'));
  });
  comparison.querySelector('.am4-use-better-price').addEventListener('click', () => {
    applyAutoPriceValues(button, JSON.parse(comparison.dataset.betterPrices || '[]'));
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'am4-better-auto-price-wrapper';
  wrapper.style.cssText = 'display:block;width:100%;max-width:100%;clear:both;';
  wrapper.appendChild(comparison);
  button.insertAdjacentElement('afterend', wrapper);
  button.dataset.hasBetterAutoPriceComparison = 'true';
}

function betterAutoPrice() {
  const autoPriceButtons = document.querySelectorAll('button[onclick*="ticketPriceSuggest"], button[onclick*="autoPrice"]');

  autoPriceButtons.forEach((autoPriceButton) => {
    if (autoPriceButton.dataset.hasBetterAutoPrice) return;

    const originalOnclick = autoPriceButton.getAttribute('onclick');
    const priceDetails = getBetterAutoPriceDetails(originalOnclick);
    if (!priceDetails) return;

    autoPriceButton.dataset.originalOnclick = originalOnclick;
    autoPriceButton.dataset.betterOnclick = priceDetails.updatedOnclick;
    autoPriceButton.dataset.originalPrices = JSON.stringify(priceDetails.originalPrices);
    autoPriceButton.dataset.betterPrices = JSON.stringify(priceDetails.betterPrices);
    autoPriceButton.setAttribute('onclick', priceDetails.updatedOnclick);

    // Update button text to indicate improved pricing
    autoPriceButton.innerHTML = autoPriceButton.innerHTML.replace(/Auto/i, 'Better Auto');
    autoPriceButton.style.maxWidth = '100%';
    autoPriceButton.style.whiteSpace = 'normal';
    addBetterAutoPriceComparison(autoPriceButton, priceDetails.originalPrices, priceDetails.betterPrices);
    autoPriceButton.dataset.hasBetterAutoPrice = 'true';
  });
}

/** Override default aircraft images with custom liveries */
function customLiveries() {
  const images = document.querySelectorAll('img[src^="assets/img/aircraft/png/"]');

  images.forEach((image) => {
    if (image.dataset.hasCustomLiveries) return;
    const imageKey = `aircraft_${image.src}`;

    // Create the edit text
    const editText = document.createElement('span');
    editText.innerHTML = '<span class="glyphicons glyphicons-pencil"></span> Click to Edit';
    editText.className = 'text-center xs-text';
    editText.style.opacity = '0.7';
    editText.style.display = 'none';

    image.parentElement.appendChild(editText);
    image.addEventListener('mouseover', () => {
      editText.style.display = 'block';
    });
    image.addEventListener('mouseout', () => {
      editText.style.display = 'none';
    });

    // Edit functionality
    image.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const newImageUrl = prompt('Enter the new image URL. Leave blank to reset:');
      if (newImageUrl === '') {
        GM_deleteValue(imageKey);
        image.src = image.dataset.originalSrc || image.src;
      } else if (newImageUrl) {
        GM_setValue(imageKey, newImageUrl);
        image.src = newImageUrl;
      }
    });

    // On page load, replace the image src if a stored URL exists
    image.dataset.originalSrc = image.src; // Save the original src
    const storedImageUrl = GM_getValue(imageKey);
    if (!!storedImageUrl) {
      image.src = storedImageUrl;
    }

    image.dataset.hasCustomLiveries = 'true';
  });
}

/** Order screen enhancements */
function getOrderRows() {
  return Array.from(document.querySelectorAll('#acListDetail div[id^="listSection"]'));
}

function orderScreenEnhancements() {
  const acListDetail = document.getElementById('acListDetail');
  if (!acListDetail) return;

  const orders = getOrderRows();
  orders.forEach((order) => {
    if (order.dataset.pax) return; // Already processed

    // Extract and store aircraft specs as data attributes
    const specText = order.querySelector('.s-text');
    const costText = order.querySelector('.text-success') || order.querySelector('.text-danger');
    const specContent = specText?.textContent || '';
    const paxMatch = specContent.match(/(\d+)\s*pax/);
    const consumptionMatch = specContent.match(/(\d+(?:\.\d+)?)\s*lbs per km/);
    const rangeMatch = specContent.match(/(\d+(?:,\d+)*)\s*km/);
    const speedMatch = specContent.match(/(\d+(?:,\d+)*)\s*kph/);
    const specs = {
      affordable: order.querySelector('.text-success') ? true : false,
      cost: parseInt((costText?.textContent || '').replace(/[\$,]/g, '')) || 0,
      pax: paxMatch ? parseInt(paxMatch[1]) || 0 : 0,
      consumption: consumptionMatch ? parseFloat(consumptionMatch[1]) || 0 : 0,
      range: rangeMatch ? parseInt(rangeMatch[1].replace(/,/g, '')) || 0 : 0,
      speed: speedMatch ? parseInt(speedMatch[1].replace(/,/g, '')) || 0 : 0,
    };
    specs.costPerPax = specs.pax ? specs.cost / specs.pax : 0;
    Object.entries(specs).forEach(([key, value]) => {
      order.dataset[key] = value;
    });

    // Create and insert the new spec display
    const newSpecs = document.createElement('div');
    newSpecs.className = 's-text';
    newSpecs.style.marginTop = '5px';
    newSpecs.innerHTML = `
      <dl class="row">
        <dt class="col-7 pr-0"><span class="glyphicons glyphicons-user text-secondary"></span> Capacity</dt>
        <dd class="col-5 m-0 pr-0">${specs.pax.toLocaleString()} pax</dd>
        <dt class="col-7 pr-0"><span class="glyphicons glyphicons-vector-path-curve text-secondary"></span> Range</dt>
        <dd class="col-5 m-0 pr-0">${specs.range.toLocaleString()} km</dd>
        <dt class="col-7 pr-0"><span class="glyphicons glyphicons-plane text-secondary"></span> Speed</dt>
        <dd class="col-5 m-0 pr-0">${specs.speed.toLocaleString()} kph</dd>
        <dt class="col-7 pr-0"><span class="glyphicons glyphicons-tint text-secondary"></span> Consumption</dt>
        <dd class="col-5 m-0 pr-0">${specs.consumption.toLocaleString()} lbs/km</dd>
        <dt class="col-7 pr-0"><span class="glyphicons glyphicons-scale text-secondary"></span> Cost / Pax</dt>
        <dd class="col-5 m-0 pr-0">$${Math.round(specs.costPerPax).toLocaleString()}</dd>
      </dl>
    `;
    if (specText) {
      specText.replaceWith(newSpecs);
    }

    // Add favorite star button to aircraft name
    const nameElem = order.querySelector('b');
    if (!nameElem?.parentElement) {
      order.dataset.pax = specs.pax;
      return;
    }
    const favoriteKey = `aircraft_favorite_${nameElem.textContent.trim()}`;
    order.dataset.favorited = GM_getValue(favoriteKey) ? 'true' : 'false';

    const favButton = document.createElement('span');
    favButton.className = 'favorite-star';
    favButton.style.color = order.dataset.favorited === 'true' ? '#ffc107' : '#007bff';
    favButton.style.visibility = order.dataset.favorited === 'true' ? 'visible' : 'hidden';
    favButton.innerHTML = ' ★';
    favButton.title = 'Toggle Favorite';
    favButton.style.cursor = 'pointer';
    favButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isFav = order.dataset.favorited === 'true';
      const newFavValue = !isFav;
      favButton.style.color = newFavValue ? '#ffc107' : '#007bff';
      if (newFavValue) {
        GM_setValue(favoriteKey, true);
      } else {
        GM_deleteValue(favoriteKey);
      }
      order.dataset.favorited = newFavValue;
    });
    nameElem.parentElement.insertBefore(favButton, nameElem.nextSibling);
    order.addEventListener('mouseenter', () => {
      favButton.style.visibility = 'visible';
    });
    order.addEventListener('mouseleave', () => {
      if (order.dataset.favorited !== 'true') {
        favButton.style.visibility = 'hidden';
      }
    });

    // Adjust column widths for better layout
    const rightCol = order.querySelector('.col-6.text-right');
    if (rightCol) {
      rightCol.className = 'col-5 text-right';
    }
    const leftCol = order.querySelector('.col-6');
    if (leftCol) {
      leftCol.className = 'col-7';
    }
  });

  // Better controls
  let controls = document.getElementById('order-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'order-controls';
    controls.className = 'd-flex align-items-center py-1 w-100';

    // Filters
    const segmentControl = document.createElement('div');
    segmentControl.className = 'btn-group btn-group-sm btn-group-toggle';
    segmentControl.setAttribute('data-toggle', 'buttons');
    segmentControl.innerHTML = `
        <label class="btn btn-outline-primary active filter-label" id="label-all">
            <input type="radio" name="filterOptions" checked> All
        </label>
        <label class="btn btn-outline-primary filter-label" id="label-favorites">
            <input type="radio" name="filterOptions"> Favorites
        </label>
        <label class="btn btn-outline-primary filter-label" id="label-affordable">
            <input type="radio" name="filterOptions"> Affordable
        </label>
    `;
    controls.appendChild(segmentControl);

    const inputs = segmentControl.querySelectorAll('label.filter-label');
    inputs.forEach((input) => {
      input.addEventListener('click', () => {
        getOrderRows().forEach((order) => {
          order.style.display = '';
          if (input.id === 'label-favorites' && order.dataset.favorited !== 'true') {
            order.style.display = 'none';
          }
          if (input.id === 'label-affordable' && order.dataset.affordable !== 'true') {
            order.style.display = 'none';
          }
        });
      });
    });

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';
    spacer.innerHTML = '&nbsp;';
    controls.appendChild(spacer);

    // Sort dropdown
    const sortSelect = document.createElement('select');
    sortSelect.id = 'sort-select';
    sortSelect.className = 'form-control form-control-sm';
    sortSelect.style.maxWidth = '200px';
    const sortOptions = [
      { value: '', text: 'Sort By' },
      { value: 'cost-asc', text: 'Cost ↑' },
      { value: 'cost-desc', text: 'Cost ↓' },
      { value: 'pax-asc', text: 'Capacity ↑' },
      { value: 'pax-desc', text: 'Capacity ↓' },
      { value: 'range-asc', text: 'Range ↑' },
      { value: 'range-desc', text: 'Range ↓' },
      { value: 'speed-asc', text: 'Speed ↑' },
      { value: 'speed-desc', text: 'Speed ↓' },
      { value: 'consumption-asc', text: 'Consumption ↑' },
      { value: 'consumption-desc', text: 'Consumption ↓' },
      { value: 'costPerPax-asc', text: 'Cost/Pax ↑' },
      { value: 'costPerPax-desc', text: 'Cost/Pax ↓' },
    ];

    sortOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      sortSelect.appendChild(opt);
    });
    sortSelect.addEventListener('change', () => {
      const [key, direction] = sortSelect.value.split('-');
      if (!key) return;
      const sortedOrders = sortElementsByDataset(getOrderRows(), key, direction);
      sortedOrders.forEach((order) => {
        order.parentElement?.appendChild(order);
      });
    });
    controls.appendChild(sortSelect);

    acListDetail.prepend(controls);
  }
}

/** Hub screen enhancements */
function getHubRouteRows() {
  const hubDetail = document.getElementById('hubDetail');
  if (!hubDetail) return [];

  return Array.from(hubDetail.querySelectorAll('table tr')).filter(
    (route) => !route.closest('#demandView') && (route.querySelector('a[onclick*="fleet_details.php?id="]') || route.querySelector('.s-text'))
  );
}

function hubScreenEnhancements() {
  const hubDetail = document.getElementById('hubDetail');
  if (!hubDetail) return;

  const hubId = hubDetail
    .querySelectorAll('.col-6.text-center.p-2.font-weight-bold')[1]
    ?.textContent?.split('/')[0];
  if (!hubId) return;

  const routes = getHubRouteRows();
  routes.forEach((route) => {
    if (route.dataset.distance) return; // Already processed

    // Extract and store route specs as data attributes

    const destinationText = route.querySelector('td b')?.nextSibling?.nextSibling?.textContent?.trim() || '';
    const destinationElem = destinationText.split('-')[1] || '';
    const distanceElem = route.querySelector('.s-text')?.textContent?.match(/([\d,]+)\s*km/) || null;
    const flightNumberElem = route.querySelector('b');
    const aircraftIdElem = route.querySelector('a[onclick*="fleet_details.php?id="]');
    const demandRegex = /Demand:\s*(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)/;
    const demandElem = Array.from(route.querySelectorAll('.s-text')).find((el) => demandRegex.test(el.textContent || ''));
    const demandMatch = demandElem ? (demandElem.textContent || '').match(demandRegex) : null;
    const demand = demandMatch
      ? {
          economy: parseInt(demandMatch[1].replace(/,/g, '')) || 0,
          business: parseInt(demandMatch[2].replace(/,/g, '')) || 0,
          first: parseInt(demandMatch[3].replace(/,/g, '')) || 0,
        }
      : { economy: 0, business: 0, first: 0 };
    const totalDemand = demand.economy + demand.business + demand.first;

    const specs = {
      destination: destinationElem,
      distance: distanceElem ? parseInt(distanceElem[1].replace(/,/g, '')) : 0,
      flightNumber: flightNumberElem ? flightNumberElem.textContent.trim().slice(1) : '',
      aircraftId: aircraftIdElem ? aircraftIdElem.textContent.trim() : '',
      demandEconomy: demand.economy,
      demandBusiness: demand.business,
      demandFirst: demand.first,
      totalDemand: totalDemand,
    };
    Object.entries(specs).forEach(([key, value]) => {
      route.dataset[key] = value;
    });
  });

  // Controls
  const controlsId = `hub-controls-${hubId}`;
  let controls = document.getElementById(controlsId);
  if (!controls) {
    controls = document.createElement('div');
    controls.id = controlsId;
    controls.className = 'd-flex align-items-center py-1 w-100 mb-2';

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';
    spacer.innerHTML = '&nbsp;';
    controls.appendChild(spacer);

    // Sort dropdown
    const sortSelect = document.createElement('select');
    sortSelect.id = 'hub-sort-select';
    sortSelect.className = 'form-control form-control-sm';
    sortSelect.style.maxWidth = '200px';
    const sortOptions = [
      { value: '', text: 'Sort By' },
      { value: 'distance-asc', text: 'Distance ↑' },
      { value: 'distance-desc', text: 'Distance ↓' },
      { value: 'destination-asc', text: 'Destination ↑' },
      { value: 'destination-desc', text: 'Destination ↓' },
      { value: 'flightNumber-asc', text: 'Flight ↑' },
      { value: 'flightNumber-desc', text: 'Flight ↓' },
      { value: 'aircraftId-asc', text: 'Aircraft ↑' },
      { value: 'aircraftId-desc', text: 'Aircraft ↓' },
      { value: 'totalDemand-asc', text: 'Total Demand ↑' },
      { value: 'totalDemand-desc', text: 'Total Demand ↓' },
      { value: 'demandEconomy-asc', text: 'Economy Demand ↑' },
      { value: 'demandEconomy-desc', text: 'Economy Demand ↓' },
      { value: 'demandBusiness-asc', text: 'Business Demand ↑' },
      { value: 'demandBusiness-desc', text: 'Business Demand ↓' },
      { value: 'demandFirst-asc', text: 'First Demand ↑' },
      { value: 'demandFirst-desc', text: 'First Demand ↓' },
    ];

    sortOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      sortSelect.appendChild(opt);
    });
    sortSelect.addEventListener('change', () => {
      const [key, direction] = sortSelect.value.split('-');
      if (!key) return;
      const sortedRoutes = sortElementsByDataset(getHubRouteRows(), key, direction);
      sortedRoutes.forEach((route) => {
        route.parentElement?.appendChild(route);
      });
    });
    controls.appendChild(sortSelect);

    // append controls after table header
    const header = hubDetail.querySelector('.text-center.p-1.font-weight-bold.m-text');
    if (header) {
      header.appendChild(controls);
    }
  }
}

/** Navbar enhancements */
function navbarEnhancements() {
  // Get the navbar element
  const li = document.querySelector('li[data-original-title="Co2 quotas & Fuel holding"]');
  if (!li || li.dataset.navbarEnhancementsBound) return;

  // Debounce and cache fetches
  let fetched = false,
    lastFetch = 0,
    fuel = 'N/A',
    co2 = 'N/A',
    resourcePriceText = '';
  const setTooltipText = (text) => {
    li.setAttribute('data-original-title', text);
    li.setAttribute('title', text);
  };
  const updateTooltipText = () => {
    setTooltipText(`Fuel holding: ${fuel}\nCo2 quotas: ${co2}${resourcePriceText ? `\n${resourcePriceText}` : ''}`);
  };

  const fetchAndUpdate = () => {
    const now = Date.now();
    if (fetched || now - lastFetch < 5000) {
      // Debounce so we don't spam requests
      return;
    }
    fetched = true;
    lastFetch = now;
    fetch('/overview.php')
      .then((r) => r.text())
      .then((html) => {
        // Parse and extract values
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('table tr').forEach((row) => {
          const tds = row.querySelectorAll('td');
          if (tds.length >= 2) {
            const label = tds[0].textContent.trim(),
              val = tds[1].textContent.trim();
            if (/fuel holding/i.test(label)) fuel = val;
            if (/co2 quotas?/i.test(label)) co2 = val;
          }
        });
        updateTooltipText();
      })
      .finally(() => {
        fetched = false;
      });
  };

  const updateResourcePriceText = () => {
    fetchResourcePrices()
      .then((data) => {
        resourcePriceText = getResourcePriceTooltipText(data, new Date());
        updateTooltipText();
      })
      .catch(() => {});
  };

  // Initial fetch on page load
  fetchAndUpdate();

  // Mouse events: fetch on mouseenter, reset on mouseout
  li.addEventListener('mouseenter', () => {
    fetchAndUpdate();
    updateResourcePriceText();
  });
  li.addEventListener('mouseout', () => (fetched = false));
  if (!document.getElementById('am4-resource-market-nav-button')) {
    const marketButton = document.createElement('button');
    marketButton.id = 'am4-resource-market-nav-button';
    marketButton.type = 'button';
    marketButton.className = 'btn btn-xs-real btn-outline-info ml-1';
    marketButton.textContent = 'Market';
    marketButton.title = 'Open Resource Market';
    marketButton.style.marginLeft = '4px';
    marketButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openResourceMarketModal();
    });
    if (li.tagName === 'LI') {
      const marketItem = document.createElement('li');
      marketItem.className = li.className;
      marketItem.appendChild(marketButton);
      li.insertAdjacentElement('afterend', marketItem);
    } else {
      li.insertAdjacentElement('afterend', marketButton);
    }
  }

  // Mark as initialized
  li.dataset.navbarEnhancementsBound = 'true';
}

/** Maintenance screen enhancements */
function maintenanceScreenEnhancements() {
  const acList = document.querySelectorAll('#maintAction #acListView div');
  if (!acList || acList.length === 0) return;

  acList.forEach((row) => {
    if (row.dataset.maintenanceEnhancementsBound) return; // Already processed

    // Get aircraft id
    const controlsDiv = row.querySelector('.controls');
    if (!controlsDiv || controlsDiv.dataset.maintenanceEnhancementsBound) return;
    const aircraftId = controlsDiv.id.replace('controls', '');
    if (!aircraftId) return;

    // Add locate button
    const btnGroup = controlsDiv.querySelector('.btn-group');
    if (btnGroup) {
      btnGroup.insertAdjacentHTML(
        'beforeend',
        `<button class="btn btn-xs-real btn-outline-dark" onclick="closePop(); showFlightInfo(this, '${aircraftId}', 7);">
           <span class="glyphicons glyphicons-map-marker"></span> Locate
         </button>`
      );
    }

    controlsDiv.dataset.maintenanceEnhancementsBound = 'true';
  });
}

function fetchResourcePrices() {
  if (resourcePricesData) return Promise.resolve(resourcePricesData);
  if (resourcePricesPromise) return resourcePricesPromise;

  const requestPromise = new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      const error = new Error('GM_xmlhttpRequest is unavailable');
      console.error('AM4 resource price tooltip fetch failure', error);
      reject(error);
      return;
    }

    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: RESOURCE_PRICE_SCHEDULE_URL,
        timeout: 15000,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) {
            const error = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
            console.error('AM4 resource price tooltip HTTP failure', error);
            reject(error);
            return;
          }

          try {
            resourcePricesData = JSON.parse(response.responseText);
            resolve(resourcePricesData);
          } catch (error) {
            console.error('AM4 resource price tooltip parse failure', error);
            reject(error);
          }
        },
        onerror: (error) => {
          console.error('AM4 resource price tooltip network failure', error);
          reject(error);
        },
        ontimeout: (error) => {
          console.error('AM4 resource price tooltip timeout failure', error);
          reject(error);
        },
        onabort: (error) => {
          console.error('AM4 resource price tooltip fetch failure', error);
          reject(error);
        },
      });
    } catch (error) {
      console.error('AM4 resource price tooltip fetch failure', error);
      reject(error);
    }
  });

  resourcePricesPromise = requestPromise.catch((error) => {
    resourcePricesPromise = null;
    throw error;
  });

  return resourcePricesPromise;
}

function getUtcResourcePriceSlot(now) {
  const minute = now.getUTCMinutes() < 30 ? 0 : 30;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), minute, 0, 0));
}

function getResourcePriceDayEntries(data, slotStart) {
  if (!data) return null;

  const day = slotStart.getUTCDate();
  const dayKeys = [String(day), String(day).padStart(2, '0')];
  const monthKey = (slotStart.getUTCMonth() + 1) % 2 === 0 ? 'evenMonth' : 'oddMonth';
  const buckets = [data[monthKey], data];

  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const dayKey of dayKeys) {
      if (Array.isArray(bucket[dayKey])) {
        return bucket[dayKey];
      }
    }
  }

  return null;
}

function getCurrentResourcePrice(data, now) {
  const slotStart = getUtcResourcePriceSlot(now);
  const entries = getResourcePriceDayEntries(data, slotStart);
  if (!entries) return null;

  const slotMinute = slotStart.getUTCMinutes();
  const slotIndex = slotStart.getUTCHours() * 2 + (slotMinute === 30 ? 1 : 0);
  let entry = entries.find((price) => {
    if (!price || !price.time) return false;
    const priceTime = new Date(price.time);
    if (Number.isNaN(priceTime.getTime())) return false;
    return priceTime.getUTCHours() === slotStart.getUTCHours() && priceTime.getUTCMinutes() === slotMinute;
  });

  if (!entry && entries[slotIndex]) {
    entry = entries[slotIndex];
  }
  if (!entry) return null;

  return {
    ...entry,
    slotStart: slotStart.toISOString(),
  };
}

function getResourcePriceSlotEnd(slotStartIso) {
  return new Date(new Date(slotStartIso).getTime() + 30 * 60 * 1000);
}

function getResourceAlertSettings() {
  const storedSettings = GM_getValue(RESOURCE_ALERT_SETTINGS_KEY, {});
  return {
    ...RESOURCE_PRICE_ALERTS,
    ...(storedSettings && typeof storedSettings === 'object' ? storedSettings : {}),
  };
}

function setResourceAlertSettings(settings) {
  const fuelThreshold = Number(settings.fuelThreshold);
  const co2Threshold = Number(settings.co2Threshold);
  GM_setValue(RESOURCE_ALERT_SETTINGS_KEY, {
    enabled: !!settings.enabled,
    fuelThreshold: Number.isFinite(fuelThreshold) ? fuelThreshold : RESOURCE_PRICE_ALERTS.fuelThreshold,
    co2Threshold: Number.isFinite(co2Threshold) ? co2Threshold : RESOURCE_PRICE_ALERTS.co2Threshold,
  });
}

function notifyResourcePriceLow(resourceKey, price, slotStartIso) {
  if (!window.Notification || Notification.permission !== 'granted') return false;

  const resourceName = resourceKey === 'co2' ? 'CO2' : 'Fuel';
  const validUntil = formatResourcePriceTime(getResourcePriceSlotEnd(slotStartIso));
  try {
    new Notification(`${resourceName} is low: $${price}`, {
      body: `Valid until ${validUntil}`,
      icon: 'https://www.airlinemanager.com/favicon.ico',
    });
    notificationSound.play().catch(() => {});
    return true;
  } catch (error) {
    console.error('AM4 resource price alert notification failure', error);
    return false;
  }
}

async function checkResourcePriceAlerts() {
  const settings = getResourceAlertSettings();
  if (!settings.enabled) return;

  let price;
  try {
    const data = await fetchResourcePrices();
    price = getCurrentResourcePrice(data, new Date());
  } catch (error) {
    return;
  }
  if (!price?.slotStart) return;

  const resources = [
    { key: 'fuel', threshold: Number(settings.fuelThreshold) },
    { key: 'co2', threshold: Number(settings.co2Threshold) },
  ];

  resources.forEach(({ key, threshold }) => {
    const value = Number(price[key]);
    if (!Number.isFinite(value) || !Number.isFinite(threshold) || value > threshold) return;

    const alertKey = `am4-resource-alert:${price.slotStart}:${key}:${value}`;
    if (GM_getValue(alertKey)) return;

    if (notifyResourcePriceLow(key, value, price.slotStart)) {
      GM_setValue(alertKey, new Date().toISOString());
    }
  });
}

function resourcePriceAlerts() {
  if (window._am4ResourcePriceAlertsInitialized) return;
  window._am4ResourcePriceAlertsInitialized = true;

  checkResourcePriceAlerts();
  window.setInterval(checkResourcePriceAlerts, 60 * 1000);
}

function getTodayLowResourcePrices(data, now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const lows = {
    fuel: null,
    co2: null,
  };

  for (let slot = new Date(start); slot < end; slot = new Date(slot.getTime() + 30 * 60 * 1000)) {
    const price = getCurrentResourcePrice(data, slot);
    if (!price) continue;

    const fuel = Number(price.fuel);
    const co2 = Number(price.co2);
    if (Number.isFinite(fuel) && (!lows.fuel || fuel < lows.fuel.price)) {
      lows.fuel = { price: fuel, time: new Date(slot) };
    }
    if (Number.isFinite(co2) && (!lows.co2 || co2 < lows.co2.price)) {
      lows.co2 = { price: co2, time: new Date(slot) };
    }
  }

  return lows;
}

function formatResourcePriceTime(date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function getResourcePriceTooltipText(data, now) {
  const lows = getTodayLowResourcePrices(data, now);
  const lines = ['Today low prices'];

  if (lows.fuel) {
    lines.push(`Fuel: $${lows.fuel.price} at ${formatResourcePriceTime(lows.fuel.time)}`);
  }
  if (lows.co2) {
    lines.push(`CO2: $${lows.co2.price} at ${formatResourcePriceTime(lows.co2.time)}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

function ensureResourceMarketStyles() {
  if (document.getElementById('am4-resource-market-styles')) return;

  const style = document.createElement('style');
  style.id = 'am4-resource-market-styles';
  style.textContent = `
    #${RESOURCE_MARKET_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.62);
      color: #111827;
      font-family: Inter, Arial, Helvetica, sans-serif;
    }
    #${RESOURCE_MARKET_MODAL_ID}[hidden] {
      display: none;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-window {
      width: min(920px, calc(100vw - 28px));
      max-height: calc(100vh - 28px);
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 10px;
      background: #f8fafc;
      box-shadow: 0 22px 70px rgba(15, 23, 42, 0.42);
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 56px;
      padding: 12px 18px;
      background: #1d4ed8;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-close {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255, 255, 255, 0.32);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 14px 18px 0;
      background: #f8fafc;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-tab {
      min-height: 40px;
      border: 1px solid #cbd5e1;
      border-radius: 8px 8px 0 0;
      background: #e2e8f0;
      color: #334155;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-tab.active {
      background: #ffffff;
      border-bottom-color: #ffffff;
      color: #1d4ed8;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-body {
      position: relative;
      max-height: calc(100vh - 132px);
      overflow: auto;
      padding: 18px;
      border-top: 1px solid #cbd5e1;
      background: #ffffff;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-status {
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
      font-size: 18px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-summary-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      padding: 8px 10px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-summary-label {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-summary-value {
      color: #0f172a;
      font-size: 15px;
      font-weight: 700;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-settings {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 13px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-settings input[type="number"] {
      width: 82px;
      min-height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 3px 6px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-chart-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 8px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-chart-title {
      margin: 0;
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-best {
      color: #166534;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-chart-wrap {
      position: relative;
      margin-bottom: 22px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      overflow: hidden;
      min-height: 148px;
    }
    #${RESOURCE_MARKET_MODAL_ID} canvas.am4-resource-market-chart {
      display: block;
      width: 100%;
      height: 148px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-hover {
      position: absolute;
      display: none;
      pointer-events: none;
      z-index: 2;
      max-width: 180px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      font-size: 12px;
      line-height: 1.25;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-day-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      color: #0f172a;
      font-size: 16px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-day-controls input {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      background: #ffffff;
      color: #111827;
      font-size: 16px;
      padding: 4px 8px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      color: #111827;
      font-size: 14px;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table th,
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      text-align: right;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table th:first-child,
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table td:first-child {
      text-align: left;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table th {
      position: sticky;
      top: 0;
      background: #f1f5f9;
      z-index: 1;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table td.am4-resource-market-low,
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table tr:nth-child(even) td.am4-resource-market-low {
      background: #dcfce7;
      color: #14532d;
      font-weight: 700;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table td.am4-resource-market-low-time,
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table tr:nth-child(even) td.am4-resource-market-low-time {
      background: #bbf7d0;
      color: #14532d;
      font-weight: 700;
    }
    #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-table tr.am4-resource-market-current-row td {
      box-shadow: inset 0 0 0 2px #2563eb;
    }
    @media (max-width: 720px) {
      #${RESOURCE_MARKET_MODAL_ID} .am4-resource-market-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;
  document.head.appendChild(style);
}

function toLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getResourceMarketWindowEntries(data, now) {
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const firstSlot = getUtcResourcePriceSlot(start);
  const entries = [];

  if (firstSlot < start) {
    firstSlot.setUTCMinutes(firstSlot.getUTCMinutes() + 30);
  }

  for (let slot = new Date(firstSlot); slot <= end; slot = new Date(slot.getTime() + 30 * 60 * 1000)) {
    const price = getCurrentResourcePrice(data, slot);
    if (!price) continue;
    entries.push({
      time: new Date(slot),
      fuel: Number(price.fuel),
      co2: Number(price.co2),
    });
  }

  return { start, end, entries };
}

function getResourceMarketDayEntries(data, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  const entries = [];

  for (let slot = new Date(start); slot < end; slot = new Date(slot.getTime() + 30 * 60 * 1000)) {
    const price = getCurrentResourcePrice(data, slot);
    if (!price) continue;
    entries.push({
      time: new Date(slot),
      fuel: Number(price.fuel),
      co2: Number(price.co2),
    });
  }

  return entries;
}

function getBestUpcomingResourcePrice(windowData, resourceKey, now) {
  const upcoming = windowData.entries.filter((entry) => Number.isFinite(entry[resourceKey]) && entry.time >= now);
  if (!upcoming.length) return null;

  return upcoming.reduce((best, entry) => (!best || entry[resourceKey] < best[resourceKey] ? entry : best), null);
}

function formatResourceMarketEta(date, now) {
  const totalSeconds = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getLowestResourceIndexes(entries, resourceKey, count) {
  return new Set(
    entries
      .map((entry, index) => ({ index, value: entry[resourceKey] }))
      .filter((entry) => Number.isFinite(entry.value))
      .sort((a, b) => a.value - b.value)
      .slice(0, count)
      .map((entry) => entry.index)
  );
}

function getResourceMarketCurrentInfo(data, now) {
  const price = getCurrentResourcePrice(data, now);
  if (!price?.slotStart) return null;

  return {
    fuel: Number(price.fuel),
    co2: Number(price.co2),
    slotStart: new Date(price.slotStart),
    slotEnd: getResourcePriceSlotEnd(price.slotStart),
  };
}

function getCanvasPointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
    cssX: event.clientX - rect.left,
    cssY: event.clientY - rect.top,
  };
}

function drawResourceMarketChart(canvas, hoverLabel, windowData, resourceKey, now) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 16 * dpr, right: 18 * dpr, bottom: 24 * dpr, left: 34 * dpr };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = windowData.entries
    .map((entry) => entry[resourceKey])
    .filter((value) => Number.isFinite(value));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const valueRange = Math.max(1, maxValue - minValue);
  const timeRange = Math.max(1, windowData.end.getTime() - windowData.start.getTime());

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 * dpr;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const points = windowData.entries
    .filter((entry) => Number.isFinite(entry[resourceKey]))
    .map((entry) => {
      const x = padding.left + ((entry.time.getTime() - windowData.start.getTime()) / timeRange) * plotWidth;
      const y = padding.top + (1 - (entry[resourceKey] - minValue) / valueRange) * plotHeight;
      return { ...entry, x, y, value: entry[resourceKey] };
    });

  ctx.strokeStyle = resourceKey === 'fuel' ? '#1c7ed6' : '#2f9e44';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();

  const nowX = padding.left + ((now.getTime() - windowData.start.getTime()) / timeRange) * plotWidth;
  ctx.strokeStyle = '#ff1d34';
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.moveTo(nowX, padding.top - 2 * dpr);
  ctx.lineTo(nowX, height - padding.bottom + 2 * dpr);
  ctx.stroke();

  ctx.fillStyle = '#333333';
  ctx.font = `${11 * dpr}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(formatResourcePriceTime(windowData.start), padding.left, height - 7 * dpr);
  ctx.textAlign = 'center';
  ctx.fillText('Now', nowX, height - 7 * dpr);
  ctx.textAlign = 'right';
  ctx.fillText(formatResourcePriceTime(windowData.end), width - padding.right, height - 7 * dpr);

  canvas._am4ResourcePoints = points;
  canvas._am4ResourceHoverLabel = hoverLabel;
}

function bindResourceMarketChartHover(canvas) {
  if (canvas.dataset.resourceMarketHoverBound) return;

  canvas.addEventListener('mousemove', (event) => {
    const points = canvas._am4ResourcePoints || [];
    const hoverLabel = canvas._am4ResourceHoverLabel;
    if (!points.length || !hoverLabel) return;

    const pointer = getCanvasPointerPosition(canvas, event);
    const nearest = points.reduce((best, point) => {
      const distance = Math.abs(point.x - pointer.x);
      return !best || distance < best.distance ? { point, distance } : best;
    }, null);
    if (!nearest) return;

    hoverLabel.textContent = `$${nearest.point.value} at ${formatResourcePriceTime(nearest.point.time)}`;
    hoverLabel.style.left = `${Math.min(pointer.cssX + 12, canvas.clientWidth - 170)}px`;
    hoverLabel.style.top = `${Math.max(8, pointer.cssY - 34)}px`;
    hoverLabel.style.display = 'block';
  });

  canvas.addEventListener('mouseleave', () => {
    const hoverLabel = canvas._am4ResourceHoverLabel;
    if (hoverLabel) {
      hoverLabel.style.display = 'none';
    }
  });

  canvas.dataset.resourceMarketHoverBound = 'true';
}

function getResourceMarketElements(modal) {
  if (modal._am4ResourceMarketElements) return modal._am4ResourceMarketElements;

  const charts = {};
  const bestLabels = {};
  RESOURCE_MARKET_RESOURCES.forEach((resourceKey) => {
    const canvas = modal.querySelector(`canvas.am4-resource-market-chart[data-resource="${resourceKey}"]`);
    charts[resourceKey] = {
      canvas,
      hoverLabel: canvas?.parentElement?.querySelector('.am4-resource-market-hover'),
    };
    bestLabels[resourceKey] = modal.querySelector(`.am4-resource-market-best[data-resource="${resourceKey}"]`);
  });

  modal._am4ResourceMarketElements = {
    status: modal.querySelector('.am4-resource-market-status'),
    content: modal.querySelector('.am4-resource-market-content'),
    closeButton: modal.querySelector('.am4-resource-market-close'),
    tabs: Array.from(modal.querySelectorAll('.am4-resource-market-tab')),
    panels: Array.from(modal.querySelectorAll('.am4-resource-market-panel')),
    dateInput: modal.querySelector('#am4-resource-market-date'),
    dayTableBody: modal.querySelector('.am4-resource-market-table tbody'),
    currentFuel: modal.querySelector('[data-current-resource="fuel"]'),
    currentCo2: modal.querySelector('[data-current-resource="co2"]'),
    slotStart: modal.querySelector('[data-current-slot="start"]'),
    slotEnd: modal.querySelector('[data-current-slot="end"]'),
    alertEnabled: modal.querySelector('#am4-resource-alert-enabled'),
    fuelThreshold: modal.querySelector('#am4-resource-fuel-threshold'),
    co2Threshold: modal.querySelector('#am4-resource-co2-threshold'),
    charts,
    bestLabels,
  };

  return modal._am4ResourceMarketElements;
}

function renderResourceMarketSettings(modal) {
  const elements = getResourceMarketElements(modal);
  const settings = getResourceAlertSettings();

  elements.alertEnabled.checked = !!settings.enabled;
  elements.fuelThreshold.value = settings.fuelThreshold;
  elements.co2Threshold.value = settings.co2Threshold;
}

function saveResourceMarketSettings(modal) {
  const elements = getResourceMarketElements(modal);
  setResourceAlertSettings({
    enabled: elements.alertEnabled.checked,
    fuelThreshold: Number(elements.fuelThreshold.value),
    co2Threshold: Number(elements.co2Threshold.value),
  });
  checkResourcePriceAlerts();
}

function renderResourceMarketCurrentInfo(modal, data, now) {
  const elements = getResourceMarketElements(modal);
  const current = getResourceMarketCurrentInfo(data, now);

  elements.currentFuel.textContent = current && Number.isFinite(current.fuel) ? `$${current.fuel}` : 'N/A';
  elements.currentCo2.textContent = current && Number.isFinite(current.co2) ? `$${current.co2}` : 'N/A';
  elements.slotStart.textContent = current ? formatResourcePriceTime(current.slotStart) : 'N/A';
  elements.slotEnd.textContent = current ? formatResourcePriceTime(current.slotEnd) : 'N/A';
}

function renderResourceMarketWindow(modal, data, redrawCharts = true) {
  const elements = getResourceMarketElements(modal);
  const now = new Date();
  const windowData = getResourceMarketWindowEntries(data, now);
  renderResourceMarketCurrentInfo(modal, data, now);

  RESOURCE_MARKET_RESOURCES.forEach((resourceKey) => {
    const label = elements.bestLabels[resourceKey];
    const best = getBestUpcomingResourcePrice(windowData, resourceKey, now);
    if (!label) return;
    label.textContent = best
      ? `Best price next: $${best[resourceKey]} in ${formatResourceMarketEta(best.time, now)}`
      : 'Best price next: N/A';
  });

  if (!redrawCharts) return;

  RESOURCE_MARKET_RESOURCES.forEach((resourceKey) => {
    const chart = elements.charts[resourceKey];
    const canvas = chart?.canvas;
    if (!canvas) return;

    bindResourceMarketChartHover(canvas);
    drawResourceMarketChart(canvas, chart.hoverLabel, windowData, resourceKey, now);
  });
}

function renderResourceMarketDayTable(modal, data, selectedDate) {
  const tbody = getResourceMarketElements(modal).dayTableBody;
  const entries = getResourceMarketDayEntries(data, selectedDate);
  const lowFuelIndexes = getLowestResourceIndexes(entries, 'fuel', 3);
  const lowCo2Indexes = getLowestResourceIndexes(entries, 'co2', 3);
  const currentSlotTime = getUtcResourcePriceSlot(new Date()).getTime();

  tbody.innerHTML = entries
    .map((entry, index) => {
      const isLowFuel = lowFuelIndexes.has(index);
      const isLowCo2 = lowCo2Indexes.has(index);
      const timeClass = isLowFuel || isLowCo2 ? ' class="am4-resource-market-low-time"' : '';
      const fuelClass = isLowFuel ? ' class="am4-resource-market-low"' : '';
      const co2Class = isLowCo2 ? ' class="am4-resource-market-low"' : '';
      const rowClass = entry.time.getTime() === currentSlotTime ? ' class="am4-resource-market-current-row"' : '';

      return `
        <tr${rowClass}>
          <td${timeClass}>${formatResourcePriceTime(entry.time)}</td>
          <td${fuelClass}>${Number.isFinite(entry.fuel) ? `$${entry.fuel}` : 'N/A'}</td>
          <td${co2Class}>${Number.isFinite(entry.co2) ? `$${entry.co2}` : 'N/A'}</td>
        </tr>
      `;
    })
    .join('');
}

function getActiveResourceMarketTab(modal) {
  return getResourceMarketElements(modal).tabs.find((tab) => tab.classList.contains('active'))?.dataset.tab || 'window';
}

function activateResourceMarketTab(modal, tabName) {
  const elements = getResourceMarketElements(modal);

  elements.tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });

  if (tabName === 'window' && resourcePricesData) {
    window.requestAnimationFrame(() => renderResourceMarketWindow(modal, resourcePricesData));
  }
}

function buildResourceMarketModal() {
  ensureResourceMarketStyles();

  const modal = document.createElement('div');
  modal.id = RESOURCE_MARKET_MODAL_ID;
  modal.hidden = true;
  modal.tabIndex = -1;
  modal.innerHTML = `
    <div class="am4-resource-market-window" role="dialog" aria-modal="true" aria-label="Resource Market">
      <div class="am4-resource-market-titlebar">
        <span>Resource Market</span>
        <button type="button" class="am4-resource-market-close" aria-label="Close">&times;</button>
      </div>
      <div class="am4-resource-market-tabs" role="tablist">
        <button type="button" class="am4-resource-market-tab active" data-tab="window" role="tab">24h Window</button>
        <button type="button" class="am4-resource-market-tab" data-tab="day" role="tab">Day View</button>
      </div>
      <div class="am4-resource-market-body">
        <div class="am4-resource-market-status">Loading resource market...</div>
        <div class="am4-resource-market-content" hidden>
          <div class="am4-resource-market-summary">
            <div class="am4-resource-market-summary-item">
              <span class="am4-resource-market-summary-label">Current Fuel</span>
              <span class="am4-resource-market-summary-value" data-current-resource="fuel">N/A</span>
            </div>
            <div class="am4-resource-market-summary-item">
              <span class="am4-resource-market-summary-label">Current CO2</span>
              <span class="am4-resource-market-summary-value" data-current-resource="co2">N/A</span>
            </div>
            <div class="am4-resource-market-summary-item">
              <span class="am4-resource-market-summary-label">Slot Start</span>
              <span class="am4-resource-market-summary-value" data-current-slot="start">N/A</span>
            </div>
            <div class="am4-resource-market-summary-item">
              <span class="am4-resource-market-summary-label">Slot End</span>
              <span class="am4-resource-market-summary-value" data-current-slot="end">N/A</span>
            </div>
          </div>
          <div class="am4-resource-market-settings">
            <label><input id="am4-resource-alert-enabled" type="checkbox"> Low-price alerts</label>
            <label>Fuel threshold <input id="am4-resource-fuel-threshold" type="number" min="0" step="1"></label>
            <label>CO2 threshold <input id="am4-resource-co2-threshold" type="number" min="0" step="1"></label>
          </div>
          <div class="am4-resource-market-panel" data-panel="window">
            <div class="am4-resource-market-chart-header">
              <h3 class="am4-resource-market-chart-title">Fuel</h3>
              <span class="am4-resource-market-best" data-resource="fuel">Best price next: N/A</span>
            </div>
            <div class="am4-resource-market-chart-wrap">
              <canvas class="am4-resource-market-chart" data-resource="fuel"></canvas>
              <div class="am4-resource-market-hover"></div>
            </div>
            <div class="am4-resource-market-chart-header">
              <h3 class="am4-resource-market-chart-title">CO2</h3>
              <span class="am4-resource-market-best" data-resource="co2">Best price next: N/A</span>
            </div>
            <div class="am4-resource-market-chart-wrap">
              <canvas class="am4-resource-market-chart" data-resource="co2"></canvas>
              <div class="am4-resource-market-hover"></div>
            </div>
          </div>
          <div class="am4-resource-market-panel" data-panel="day" hidden>
            <div class="am4-resource-market-day-controls">
              <label for="am4-resource-market-date">Date</label>
              <input id="am4-resource-market-date" type="date">
            </div>
            <table class="am4-resource-market-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Fuel</th>
                  <th>CO2</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeResourceMarketModal();
    }
  });
  const elements = getResourceMarketElements(modal);
  elements.closeButton.addEventListener('click', closeResourceMarketModal);
  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateResourceMarketTab(modal, tab.dataset.tab));
  });
  [elements.alertEnabled, elements.fuelThreshold, elements.co2Threshold].forEach((input) => {
    input.addEventListener('change', () => saveResourceMarketSettings(modal));
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeResourceMarketModal();
    }
  });

  document.body.appendChild(modal);
  if (window.ResizeObserver) {
    modal._am4ResourceMarketResizeObserver = new ResizeObserver(() => {
      if (!modal.hidden && resourcePricesData && getActiveResourceMarketTab(modal) === 'window') {
        window.requestAnimationFrame(() => renderResourceMarketWindow(modal, resourcePricesData));
      }
    });
    modal._am4ResourceMarketResizeObserver.observe(modal.querySelector('.am4-resource-market-window'));
  }
  return modal;
}

function closeResourceMarketModal() {
  const modal = document.getElementById(RESOURCE_MARKET_MODAL_ID);
  if (!modal) return;

  modal.hidden = true;
  if (window._am4ResourceMarketCountdownTimer) {
    window.clearInterval(window._am4ResourceMarketCountdownTimer);
    window._am4ResourceMarketCountdownTimer = null;
  }
  if (window._am4ResourceMarketChartTimer) {
    window.clearInterval(window._am4ResourceMarketChartTimer);
    window._am4ResourceMarketChartTimer = null;
  }
}

function openResourceMarketModal() {
  const modal = document.getElementById(RESOURCE_MARKET_MODAL_ID) || buildResourceMarketModal();
  const elements = getResourceMarketElements(modal);

  modal.hidden = false;
  modal.focus();
  elements.status.textContent = resourcePricesData ? '' : 'Loading resource market...';
  elements.status.hidden = !!resourcePricesData;
  elements.content.hidden = !resourcePricesData;

  fetchResourcePrices()
    .then((data) => {
      const renderDay = () => {
        const [year, month, day] = elements.dateInput.value.split('-').map((value) => Number(value));
        renderResourceMarketDayTable(modal, data, new Date(year, month - 1, day, 0, 0, 0, 0));
      };

      elements.dateInput.value = elements.dateInput.value || toLocalDateInputValue(new Date());
      elements.dateInput.onchange = renderDay;
      elements.status.hidden = true;
      elements.content.hidden = false;
      renderResourceMarketSettings(modal);
      activateResourceMarketTab(modal, getActiveResourceMarketTab(modal));
      renderResourceMarketWindow(modal, data);
      renderDay();

      if (window._am4ResourceMarketCountdownTimer) {
        window.clearInterval(window._am4ResourceMarketCountdownTimer);
      }
      if (window._am4ResourceMarketChartTimer) {
        window.clearInterval(window._am4ResourceMarketChartTimer);
      }
      window._am4ResourceMarketCountdownTimer = window.setInterval(() => {
        if (!modal.hidden && getActiveResourceMarketTab(modal) === 'window') {
          renderResourceMarketWindow(modal, data, false);
        }
      }, 1000);
      window._am4ResourceMarketChartTimer = window.setInterval(() => {
        if (!modal.hidden && getActiveResourceMarketTab(modal) === 'window') {
          renderResourceMarketWindow(modal, data);
        }
      }, 60 * 1000);
    })
    .catch(() => {
      elements.status.textContent = 'Resource market unavailable.';
      elements.status.hidden = false;
      elements.content.hidden = true;
    });
}

/** Adds browser notifiations for when the landed list and parked list change */
function browserNotifications() {
  const notify = (message) => {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(message, { icon: 'https://www.airlinemanager.com/favicon.ico' });
      notificationSound.play().catch(() => {});
    }
  };

  const observeList = (listId, action) => {
    const list = document.querySelector(listId);
    if (!list || list.dataset.browserNotificationsBound) return;

    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && !!node.dataset.reg) {
              notify(`${node.dataset.reg} has ${action}`);
            }
          });
        }
      });
    });
    observer.observe(list, { childList: true });
    list.dataset.browserNotificationsBound = 'true';
  };

  observeList('#landedList', 'landed');
  observeList('#parkedList', 'parked');
}

/** Play immersive sound effects */
function soundEffects() {
  // takeoff sound on flight depart buttons
  const buttons = document.querySelectorAll('button[id^="flightInfoDepart"], button[onclick*="route_depart.php"]');
  buttons.forEach((button) => {
    if (button.dataset.hasTakeoffSound) return;
    button.addEventListener('click', () => {
      takeoffSound.play().catch(() => {});
    });
    button.dataset.hasTakeoffSound = 'true';
  });
}

/**
 * Helper function to sort elements based on dataset values.
 * Handles both numeric and string sorting.
 */
function sortElementsByDataset(elements, key, direction) {
  return elements.sort((a, b) => {
    const valA = a.dataset[key] ?? '';
    const valB = b.dataset[key] ?? '';

    const isNumericA = !isNaN(parseFloat(valA)) && isFinite(valA);
    const isNumericB = !isNaN(parseFloat(valB)) && isFinite(valB);

    if (isNumericA && isNumericB) {
      return direction === 'asc' ? parseFloat(valA) - parseFloat(valB) : parseFloat(valB) - parseFloat(valA);
    } else {
      return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
  });
}

(function () {
  console.log('Starting AM4 Usability & Immersion');

  const runSafely = (name, fn) => {
    try {
      fn();
    } catch (error) {
      console.error(`AM4 enhancement failed: ${name}`, error);
    }
  };

  const runEnhancements = () => {
    // play startup sound
    if (!window._am4StartupSoundPlayed) {
      startupSound
        .play()
        .then(() => (window._am4StartupSoundPlayed = true))
        .catch((e) => {});
    }

    // request notification permission
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().catch((e) => {});
    }

    runSafely('hideGameAds', hideGameAds);
    runSafely('betterAutoPrice', betterAutoPrice);
    runSafely('customLiveries', customLiveries);
    runSafely('orderScreenEnhancements', orderScreenEnhancements);
    runSafely('hubScreenEnhancements', hubScreenEnhancements);
    runSafely('maintenanceScreenEnhancements', maintenanceScreenEnhancements);
    runSafely('navbarEnhancements', navbarEnhancements);
    runSafely('soundEffects', soundEffects);
    runSafely('browserNotifications', browserNotifications);
    runSafely('resourcePriceAlerts', resourcePriceAlerts);
  };

  let enhancementQueued = false;
  const queueEnhancements = () => {
    if (enhancementQueued) return;

    enhancementQueued = true;
    window.requestAnimationFrame(() => {
      enhancementQueued = false;
      runEnhancements();
    });
  };

  new MutationObserver(queueEnhancements).observe(document.body, { childList: true, subtree: true });
  queueEnhancements();
})();
