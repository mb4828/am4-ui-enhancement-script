// ==UserScript==
// @name         AM4 UI Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Usability and Immersion improvements for Airline Manager 4
// @author       matt@mattbrauner.com
// @match        https://www.airlinemanager.com/*
// @icon         https://www.airlinemanager.com/favicon.ico
// @homepage     https://github.com/mb4828/am4-ui-enhancement-script
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
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
function betterAutoPrice() {
  const autoPriceButton = document.querySelector('button[onclick*="ticketPriceSuggest"], button[onclick*="autoPrice"]');
  if (autoPriceButton && !autoPriceButton.dataset.hasBetterAutoPrice) {
    const cmd = autoPriceButton.getAttribute('onclick');

    // extract function name and args
    const functionName = cmd.slice(0, cmd.indexOf('('));
    const args = cmd.slice(cmd.indexOf('(') + 1, cmd.indexOf(')')).split(',');

    // adjust first 3 args by multipliers
    args[0] = Math.floor(args[0] * 1.1) - 1;
    args[1] = Math.floor(args[1] * 1.08) - 1;
    args[2] = Math.floor(args[2] * 1.06) - 1;

    // set new onclick with adjusted args
    autoPriceButton.setAttribute('onclick', `${functionName}(${args.join(',')})`);

    // Update button text to indicate improved pricing
    autoPriceButton.innerHTML = autoPriceButton.innerHTML.replace(/Auto/i, 'Better Auto');
    autoPriceButton.dataset.hasBetterAutoPrice = 'true';
  }
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
      { value: 'cost-asc', text: 'Cost: Low to High' },
      { value: 'cost-desc', text: 'Cost: High to Low' },
      { value: 'pax-asc', text: 'Capacity: Low to High' },
      { value: 'pax-desc', text: 'Capacity: High to Low' },
      { value: 'range-asc', text: 'Range: Low to High' },
      { value: 'range-desc', text: 'Range: High to Low' },
      { value: 'speed-asc', text: 'Speed: Low to High' },
      { value: 'speed-desc', text: 'Speed: High to Low' },
      { value: 'consumption-asc', text: 'Consumption: Low to High' },
      { value: 'consumption-desc', text: 'Consumption: High to Low' },
      { value: 'costPerPax-asc', text: 'Cost/Pax: Low to High' },
      { value: 'costPerPax-desc', text: 'Cost/Pax: High to Low' },
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
      const sortedOrders = Array.from(orders).sort((a, b) => {
        const valA = parseFloat(a.dataset[key]) || 0;
        const valB = parseFloat(b.dataset[key]) || 0;
        return direction === 'asc' ? valA - valB : valB - valA;
      });
      sortedOrders.forEach((order) => {
        order.parentElement.appendChild(order);
      });
    });
    controls.appendChild(sortSelect);

    acListDetail.prepend(controls);
  }
}

/** Navbar enhancements */
function navbarEnhancements() {
  // Get the navbar element
  const li = document.querySelector('li[data-original-title="Co2 quotas & Fuel holding"]');
  if (!li || li.dataset.navbarEnhancementsBound) return;

  // Debounce and cache fetches
  let fetched = false,
    lastFetch = 0;
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
        let fuel = 'N/A',
          co2 = 'N/A';
        doc.querySelectorAll('table tr').forEach((row) => {
          const tds = row.querySelectorAll('td');
          if (tds.length >= 2) {
            const label = tds[0].textContent.trim(),
              val = tds[1].textContent.trim();
            if (/fuel holding/i.test(label)) fuel = val;
            if (/co2 quotas?/i.test(label)) co2 = val;
          }
        });
        li.setAttribute('data-original-title', `Fuel holding: ${fuel}\nCo2 quotas: ${co2}`);
      })
      .finally(() => {
        fetched = false;
      });
  };

  // Initial fetch on page load
  fetchAndUpdate();

  // Mouse events: fetch on mouseenter, reset on mouseout
  li.addEventListener('mouseenter', fetchAndUpdate);
  li.addEventListener('mouseout', () => (fetched = false));

  // Mark as initialized
  li.dataset.navbarEnhancementsBound = 'true';
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
    navbarEnhancements();
    soundEffects();
  };
  new MutationObserver(observerCallback).observe(document.body, { childList: true, subtree: true });

  browserNotifications();
})();
