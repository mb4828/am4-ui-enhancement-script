// ==UserScript==
// @name         AM4 UI Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Usability and Immersion improvements for Airline Manager 4
// @author       matt@mattbrauner.com
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
function getBetterAutoPriceOnclick(cmd) {
  if (!cmd) return null;

  const callMatch = cmd.match(/\b(ticketPriceSuggest|autoPrice)\s*\(([^)]*)\)/);
  if (!callMatch) return null;

  const args = callMatch[2].split(',').map((arg) => arg.trim());
  if (args.length < 3) return null;

  const multipliers = [1.1, 1.08, 1.06];
  for (let i = 0; i < multipliers.length; i++) {
    const value = Number(args[i]);
    if (!Number.isFinite(value)) return null;
    args[i] = String(Math.ceil(value * multipliers[i]) - 1);
  }

  const start = callMatch.index;
  const end = start + callMatch[0].length;
  return `${cmd.slice(0, start)}${callMatch[1]}(${args.join(',')})${cmd.slice(end)}`;
}

function betterAutoPrice() {
  const autoPriceButtons = document.querySelectorAll('button[onclick*="ticketPriceSuggest"], button[onclick*="autoPrice"]');

  autoPriceButtons.forEach((autoPriceButton) => {
    if (autoPriceButton.dataset.hasBetterAutoPrice) return;

    const updatedOnclick = getBetterAutoPriceOnclick(autoPriceButton.getAttribute('onclick'));
    if (!updatedOnclick) return;

    autoPriceButton.setAttribute('onclick', updatedOnclick);

    // Update button text to indicate improved pricing
    autoPriceButton.innerHTML = autoPriceButton.innerHTML.replace(/Auto/i, 'Better Auto');
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
function orderScreenEnhancements() {
  const acListDetail = document.getElementById('acListDetail');
  if (!acListDetail) return;

  const orders = document.querySelectorAll('#acListDetail div[id^="listSection"]');
  orders.forEach((order) => {
    if (order.dataset.pax) return; // Already processed

    // Extract and store aircraft specs as data attributes
    const specText = order.querySelector('.s-text');
    const costText = order.querySelector('.text-success') || order.querySelector('.text-danger');
    const specs = {
      affordable: order.querySelector('.text-success') ? true : false,
      cost: parseInt(costText.textContent.replace(/[\$,]/g, '')) || 0,
      pax: parseInt(specText.textContent.match(/(\d+)\s*pax/)[1]) || 0,
      consumption: parseFloat(specText.textContent.match(/(\d+(?:\.\d+)?)\s*lbs per km/)[1]) || 0,
      range: parseInt(specText.textContent.match(/(\d+(?:,\d+)*)\s*km/)[1].replace(/,/g, '')) || 0,
      speed: parseInt(specText.textContent.match(/(\d+(?:,\d+)*)\s*kph/)[1].replace(/,/g, '')) || 0,
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
    specText.replaceWith(newSpecs);

    // Add favorite star button to aircraft name
    const nameElem = order.querySelector('b');
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
        orders.forEach((order) => {
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
      const sortedOrders = sortElementsByDataset(Array.from(orders), key, direction);
      sortedOrders.forEach((order) => {
        order.parentElement.appendChild(order);
      });
    });
    controls.appendChild(sortSelect);

    acListDetail.prepend(controls);
  }
}

/** Hub screen enhancements */
function hubScreenEnhancements() {
  const hubId = document
    .querySelectorAll('#hubDetail .col-6.text-center.p-2.font-weight-bold')[1]
    ?.textContent.split('/')[0];
  if (!hubId) return;

  const routes = document.querySelectorAll('tr:not(#demandView tr)');
  routes.forEach((route) => {
    if (route.dataset.distance) return; // Already processed

    // Extract and store route specs as data attributes

    const destinationElem =
      route.querySelector('td b')?.nextSibling?.nextSibling?.textContent.trim().split('-')[1] ?? '';
    const distanceElem = route.querySelector('.s-text')?.textContent.match(/([\d,]+)\s*km/) ?? '';
    const flightNumberElem = route.querySelector('b');
    const aircraftIdElem = route.querySelector('a[onclick*="fleet_details.php?id="]');
    const demandRegex = /Demand:\s*(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)/;
    const demandElem = Array.from(route.querySelectorAll('.s-text')).find((el) => demandRegex.test(el.textContent));
    const demandMatch = demandElem ? demandElem.textContent.match(demandRegex) : null;
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
      const sortedRoutes = sortElementsByDataset(Array.from(routes), key, direction);
      sortedRoutes.forEach((route) => {
        route.parentElement.appendChild(route);
      });
    });
    controls.appendChild(sortSelect);

    // append controls after table header
    const header = document.querySelector('.text-center.p-1.font-weight-bold.m-text');
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
  li.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openResourceMarketModal();
  });
  li.style.cursor = 'pointer';

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
  if (resourcePricesPromise) return resourcePricesPromise;

  resourcePricesPromise = new Promise((resolve, reject) => {
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
    charts,
    bestLabels,
  };

  return modal._am4ResourceMarketElements;
}

function renderResourceMarketWindow(modal, data) {
  const elements = getResourceMarketElements(modal);
  const now = new Date();
  const windowData = getResourceMarketWindowEntries(data, now);

  RESOURCE_MARKET_RESOURCES.forEach((resourceKey) => {
    const label = elements.bestLabels[resourceKey];
    const best = getBestUpcomingResourcePrice(windowData, resourceKey, now);
    if (!label) return;
    label.textContent = best
      ? `Best price next: $${best[resourceKey]} in ${formatResourceMarketEta(best.time, now)}`
      : 'Best price next: N/A';
  });

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

  tbody.innerHTML = entries
    .map((entry, index) => {
      const isLowFuel = lowFuelIndexes.has(index);
      const isLowCo2 = lowCo2Indexes.has(index);
      const timeClass = isLowFuel || isLowCo2 ? ' class="am4-resource-market-low-time"' : '';
      const fuelClass = isLowFuel ? ' class="am4-resource-market-low"' : '';
      const co2Class = isLowCo2 ? ' class="am4-resource-market-low"' : '';

      return `
        <tr>
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
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeResourceMarketModal();
    }
  });

  document.body.appendChild(modal);
  return modal;
}

function closeResourceMarketModal() {
  const modal = document.getElementById(RESOURCE_MARKET_MODAL_ID);
  if (!modal) return;

  modal.hidden = true;
  if (window._am4ResourceMarketTimer) {
    window.clearInterval(window._am4ResourceMarketTimer);
    window._am4ResourceMarketTimer = null;
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
      activateResourceMarketTab(modal, getActiveResourceMarketTab(modal));
      renderResourceMarketWindow(modal, data);
      renderDay();

      if (window._am4ResourceMarketTimer) {
        window.clearInterval(window._am4ResourceMarketTimer);
      }
      window._am4ResourceMarketTimer = window.setInterval(() => {
        if (!modal.hidden && getActiveResourceMarketTab(modal) === 'window') {
          renderResourceMarketWindow(modal, data);
        }
      }, 1000);
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
      notificationSound.play();
    }
  };

  const observeList = (listId, action) => {
    const list = document.querySelector(listId);
    if (!list) return;

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
      takeoffSound.play();
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
    const valA = a.dataset[key];
    const valB = b.dataset[key];

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

  const observerCallback = () => {
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

    hideGameAds();
    betterAutoPrice();
    customLiveries();
    orderScreenEnhancements();
    hubScreenEnhancements();
    maintenanceScreenEnhancements();
    navbarEnhancements();
    soundEffects();
  };
  new MutationObserver(observerCallback).observe(document.body, { childList: true, subtree: true });
  observerCallback();

  browserNotifications();
})();
