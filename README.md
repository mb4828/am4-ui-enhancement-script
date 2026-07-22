# Airline Manager 4 (AM4) UI Enhancement Mod

## Table of Contents
- [📖 Introduction](#introduction)
- [⚙️ Installation](#installation)
- [✨ Features](#features)
  - [🎨 Custom Liveries](#-custom-liveries)
  - [✈️ Order Screen Enhancements](#%EF%B8%8F-order-screen-enhancements)
  - [🏠 Hub Screen Enhancements](#-hub-screen-enhancements)
  - [🛠️ Maintenance Screen Enhancements](#-maintenance-screen-enhancements)
  - [🔔 Browser Notifications](#-browser-notifications)
  - [⛽️ Better Fuel and Co2 Tooltip](#%EF%B8%8F-better-fuel-and-co2-tooltip)
  - [💰 Better Auto Price](#-better-auto-price)
  - [🔈 Immersive Sounds](#-immersive-sounds)
  - [🚫 Hide Game Ads](#-hide-game-ads)
- [💖 Support](#support)
- [📄 Legal](#legal)

## Introduction
The **AM4 UI Enhancement Mod** is your co-pilot for Airline Manager 4, with both **U**sability and **I**mmersion improvements to the game's UI.

### What This Is

AM4-UI is an free, open source [mod](https://en.wikipedia.org/wiki/Video_game_modding) designed to improve quality-of-life within the game as well as realism and roleplay potential. I've opted for a [userscript](https://en.wikipedia.org/wiki/Userscript) to maximize compatibility across devices and browsers and save on development time. However, since userscripts only work in the browser, this means that **AM4-UI is only compatible with the web version of the game, not the mobile app**. 

### What This Isn't

AM4-UI is **not a bot**. It does not automate any functions of the game, it **will not** play for you, or facilitate cheating or exploits. Additionally, AM4-UI does not collect any personal data or access files on your computer. All information used in this script is publicly available with open source.

### How It Works

AM4-UI is written in JavaScript. It makes alterations to the game's UI in your browser *only*. These changes do not affect other users of the game or impact the game's servers or infrastructure in any way. This is why the Custom Livery feature only works for you on your current device.

### Support Me

**If you enjoy this and would like to support my work, feel free to leave a tip via [PayPal](https://paypal.me/mattbrauner)**

<a href="https://paypal.me/mattbrauner" target="_blank"><img src="images/donate.png" alt="Donate" width="140" /></a>

## Installation
1. Install a userscript manager for your browser, such as [Tampermonkey](https://www.tampermonkey.net/).

1. Once installed, open the [GitHub Raw Link](https://raw.githubusercontent.com/mb4828/am4-ui-enhancement-script/refs/heads/main/script.user.js) for `script.user.js`.

1. **Auto-install** &mdash; If you're using Tampermonkey, it will automatically ask you if you want to install the script. This is the best way to install it, as it will automatically fetch updates when they are published to GitHub.

1. **Self-install** &mdash; If you prefer to self-install, simply copy/paste the raw script into your userscript manager.

1. Open AM4 and refresh the page. If the script is running successfully, you'll hear a ding-dong chime and see `Starting AM4 Usability & Immersion` in the browser console. You must click somewhere on the screen to hear the chime. If you don't hear the chime or see the text in the browser console, check the troubleshooting steps for your userscript manager.

## Features

### 🎨 Custom Liveries

Allows you to override default aircraft images with custom liveries.

To use, click on any aircraft picture and enter a URL to the image you'd like to replace it with.

To remove a custom image, click on the aircraft and enter a blank URL.

For help creating liveries, see my guide [here](https://github.com/mb4828/am4-ui-enhancement-script/wiki/How-to-make-a-custom-aircraft-livery-using-Pixlr).

Caveats:
1. Only works on your device and is not visible to other players.
1. If you're using multiple devices, you will have to set up the images on each device, as there is no syncing capability.
1. Some aircraft share the same image. Updating the image for an aircraft with a shared image will change it for all aircraft using that image.
1. You must have the image uploaded somewhere to use it, such as [ImgBB](https://imgbb.com/).

### ✈️ Order Screen Enhancements

Includes the following improvements to the order screen:
- Cleans up the list of stats to make it more readable
- Adds the ability to Favorite aircraft.
- Adds Cost per Passenger for quicker side-by-side comparisons.
- Adds filtering to show all, favorites, or only affordable aircraft.
- Adds sorting to organize aircraft by desired stats (e.g., cost, capacity, range).

### 🏠 Hub Screen Enhancements

Adds sorting to the Hub screen to organize routes by desired stats (e.g., id, distance, destination, demand).

### 🛠️ Maintenance Screen Enhancements

Adds a Locate button to the Maintenance Plan screen to easily locate aircraft and determine when they will be ready for maintenance.

### 🔔 Browser Notifications

Displays browser notifications when aircraft land or park, allowing you to work on other tasks without missing anything. If your sound is on, a ding will also be played. This feature is already part of the AM4 mobile app &mdash; now it's available on desktop.

To enable, click "Allow" when the popup appears asking if you want to permit notifications.

### ⛽️ Better Fuel and Co2 Tooltip

The Fuel and Co2 popup now shows the fuel and Co2 levels without having to open the fuel page. Just mouse over the fuel/Co2 gauge in the menu bar.

It also fetches the AM4 Helper resource price schedule and shows today's lowest fuel and Co2 prices in your local time. The schedule is downloaded once per page session and reused while the page is open. If the first download fails, the script will retry later instead of requiring a page refresh.

The script adds a small **Market** button next to the Fuel/Co2 gauge so the game's original Fuel/Co2 control still works normally. Click **Market** to open the Resource Market modal:
- The modal shows the current fuel price, current Co2 price, and the current 30-minute price slot start/end time.
- The 24h Window tab charts fuel and Co2 prices from 12 hours before now through 12 hours after now, with a center line for the current time.
- Each chart shows the best upcoming price and a live HH:MM:SS countdown.
- Hover over the charts to see the price and local time for the nearest price point.
- The Day View tab lets you pick a date and shows a full table for that day.
- The current price slot row is outlined, and the lowest three fuel prices and lowest three Co2 prices are highlighted in green, including their timestamps.
- Low-price browser alerts can be enabled or disabled from the modal, with editable fuel and Co2 thresholds. Alerts check the current real-world 00/30 minute price slot once per minute and only notify once per resource/price/slot.

### 💰 Better Auto Price

Automatically applies recommended multipliers (1.1, 1.08, 1.06) to the auto price button, boosting profit. Not a substitute for the Discord bot, but maybe someone can help make this better in the future.

The script also shows a compact comparison between the original Auto prices and the Better Auto prices for Economy, Business, and First. Use the **Use Original** and **Use Better** buttons to repopulate the fare inputs without recalculating prices from the game.

### 🔈 Immersive Sounds
Adds the following sound effects:
- Double ding on load to indicate that AM4-UI is running
- Single ding on aircraft landing or parking so you won't miss anything (only if you have notifications enabled)
- Pilot PA announcement for departing aircraft

I may add more in the future &mdash; I don't want it to be too annoying.

### 🚫 Hide Game Ads
Removes advertisements for other games from the interface. As someone who has paid money for the game, I'd prefer not to see ads.

## Support
Bugs or feature requests can be raised through [GitHub](https://github.com/mb4828/am4-ui-enhancement-script/issues). I sadly don't have time to respond to issues raised elsewhere (Reddit, Discord, etc).

Pull requests are always welcome!

## Legal

Copyright &copy; 2025 Matt Brauner

This program is free software: you can redistribute it and/or modify
it under the terms of the [GNU General Public License](LICENSE) as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

For legal requests, I can be reached at matt[at]mattbrauner.com.

