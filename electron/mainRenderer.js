console.time('init')

const request = require("request")
const crypto = require("crypto")
const ReconnectingWebSocket = require('./vendor/rws.js')
const fs = require('fs')

const { remote, ipcRenderer, shell } = require('electron')
const { Menu, MenuItem } = remote
let browserWindow = remote.getCurrentWindow()

window.addEventListener('beforeunload', function() {
    ws.send("die")
})

let rightClickPosition = null

const menu = new Menu()
const menuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
menu.append(menuItem)

var debug = remote.getGlobal('debug');
var useFrame = remote.getGlobal('useFrame');
var showIIDs = remote.getGlobal('showIIDs');
var showErrors = remote.getGlobal('showErrors');
var appVersionStr = remote.getGlobal('version');
var zoom = 0.8;

if (debug) {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    menu.popup(remote.getCurrentWindow())
  }, false)
}

var ws = new ReconnectingWebSocket("ws://127.0.0.1:5678/", null, {constructor: WebSocket})

var appData = {
    deck_name: "loading...",
    cant_connect: false,
    showErrors: showErrors,
    last_error: "",
    error_count: 0,
    debug: debug,
    show_iids: showIIDs,
    last_connect: 0,
    last_connect_as_seconds: 0,
    game_in_progress: false,
    game_complete: false,
    game_dismissed: false,
    show_available_decklists: true,
    no_decks: false,
    no_list_selected: true,
    list_selected: false,
    selected_list_size: "0",
    selected_list: [],
    selected_list_name: "",
    player_decks: [],
    total_cards_in_deck: "0",
    draw_stats: [],
    opponent_hand: [],
    messages: [],
    version: appVersionStr
}

var parseVersionString = (versionStr) => {
    version = {}
    version_parts = versionStr.split("-")
    if (version_parts.length > 1)
        version.suffix = version_parts[1]
    version_bits = version_parts[0].split(".")
    version.major = version_bits[0]
    version.medium = version_bits[1]
    version.minor = version_bits[2]
    return version;
}

var dismissMessage = (element) => {
   let elementIdx = element.attributes.index.value
   let messageID = false
   if (element.attributes.messageID) {
     messageID = element.attributes.messageID.value
   }
   if (messageID) {
     ipcRenderer.send('messageAcknowledged', messageID)
   }
   appData.messages[elementIdx]["show"] = false;
}

request.get({
    url: "https://wt.mtgatracker.com/wt-bd90f3fae00b1572ed028d0340861e6a-0/mtgatracker-prod-EhDvLyq7PNb/public-api/tracker-notifications",
    json: true,
    headers: {'User-Agent': 'MTGATracker-App'}
}, (err, res, data) => {
  if (appData.messages)
    appData.messages = appData.messages.concat(...data.notifications)
})

rivets.bind(document.getElementById('container'), appData)

rivets.binders.showmessage = function(el, value) {
  if (value && remote.getGlobal('messagesAcknowledged').includes(value)) {
    el.style.display = "none"
  } else {
    el.style.display = "block"
  }
}

rivets.binders.mana = function(el, value) {
    mi_class = "mi-" + value.toLowerCase()
    el.classList.remove("mi-w")
    el.classList.remove("mi-b")
    el.classList.remove("mi-g")
    el.classList.remove("mi-u")
    el.classList.remove("mi-r")
    el.classList.remove("mi-1")
    el.classList.remove("mi-2")
    el.classList.remove("mi-3")
    el.classList.remove("mi-4")
    el.classList.remove("mi-5")
    el.classList.remove("mi-6")
    el.classList.remove("mi-7")
    el.classList.remove("mi-8")
    el.classList.remove("mi-9")
    el.classList.remove("mi-10")
    el.classList.remove("mi-x")
    el.classList.add(mi_class)
}

rivets.binders.card_color = function(el, value) {

  el.classList.remove("card-b")
  el.classList.remove("card-g")
  el.classList.remove("card-r")
  el.classList.remove("card-u")
  el.classList.remove("card-w")

  el.classList.remove("card-c")  // colorless
  el.classList.remove("card-m")  // multicolor, not mountain
  let atLeastOneColor = false;

  if (value.length > 1) {
    // card-m sets the fade color
    el.classList.add("card-m")
  }

  if (value.length > 2) {
    // card-m-back sets the background image to generic 3-color background
    el.classList.add("card-m-back")
  } else {

      if (value.includes("Black")) {
        el.classList.add("card-b")
        atLeastOneColor = true
      }
      if (value.includes("White")) {
        el.classList.add("card-w")
        atLeastOneColor = true
      }
      if (value.includes("Blue")) {
        el.classList.add("card-u")
        atLeastOneColor = true
      }
       if (value.includes("Green")) {
        el.classList.add("card-g")
        atLeastOneColor = true
      }
       if (value.includes("Red")) {
        el.classList.add("card-r")
        atLeastOneColor = true
      }
      if (value.includes("Colorless") || !atLeastOneColor) {
        el.classList.add("card-c")
      }
  }
}

rivets.formatters.as_seconds = function(value) {
    return value / 100;
}

let all_hidden = false;
var hideTimeoutId;

var updateOpacity = function() {
    if (all_hidden) {
        document.getElementById("container").style.opacity = "0.1";
    } else {
        document.getElementById("container").style.opacity = "1";
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId)
            hideTimeoutId = null;
        }
    }
}

var toggleOpacity = function(hide) {
    if (hide === undefined) {
      all_hidden = !all_hidden;
    } else {
      all_hidden = hide;
    }
    updateOpacity();
    if (hideTimeoutId) {
        clearTimeout(hideTimeoutId)
        hideTimeoutId = null;
    }
    hideTimeoutId = setTimeout(function() {
        all_hidden = false;
        updateOpacity()
    }, 10000)
}

document.getElementById("floating-eye").addEventListener("click", function() {
  toggleOpacity()
})

ws.addEventListener('open', () => {
    ws.send('hello!');
    console.log("sent hello")
    ws.addEventListener('message', (m) => {
        console.debug(m)
        let mdata = JSON.parse(m.data)
        if (mdata.right_click) {
            toggleOpacity(true)
        }
        if (mdata.left_click && remote.getGlobal("leftMouseEvents")) {
            toggleOpacity(false)
        }
    })
});

function resizeWindow() {
    let total = 0;
    $.each($(".card"), function(i, c) {
        total += c.offsetHeight;
    })

    container = document.getElementById("container")

    let totalHeight = 10;

    $("#container").children().each(function(c, e) {
        if(e.style.display != "none")
            totalHeight += $(e).outerHeight(true);
    });
    bounds = browserWindow.getBounds()
    bounds.height = parseInt(totalHeight);
    container.style.height = "" + parseInt(totalHeight) + "px"
    if (!debug) {
        browserWindow.setBounds(bounds)
    } else {
        // console.log("would set height: " + totalHeight)
    }
}

function populateDeck(elem) {
    deckID = elem.getAttribute('data-deckid')
    $.each(appData.player_decks, (i, v) => {
        if (v.deck_id == deckID) {
            appData.selected_list = v.cards;
            appData.selected_list_name = v.pool_name;
            appData.list_selected = true;
            appData.no_list_selected = false;
        }
    })
    resizeWindow()
}

function unpopulateDecklist() {
    appData.list_selected = false;
    appData.no_list_selected = true;
    appData.show_available_decklists = true;
    appData.game_in_progress = false;
    resizeWindow()
}


function uploadGame(attempt, gameData, errors) {
  if (!errors) {
    errors = []
  }
  return new Promise((resolve, reject) => {
    if (attempt > 5) {
      if (!remote.getGlobal("incognito")) {
        appData.messages.push({text: "WARNING! Could not upload game result to inspector! Error log generated @ uploadfailure.log ... please send this log to our discord #bug_reports channel!"})
      }
      fs.writeFile("uploadfailure.log", JSON.stringify({fatal: "too_many_attempts", errors: errors}))
      reject({fatal: "too_many_attempts", errors: errors})
    } else {
      let delay = 1000 * attempt;
      setTimeout(() => {
        console.log("sending token request...")
        request.get({
            url: "https://wt.mtgatracker.com/wt-bd90f3fae00b1572ed028d0340861e6a-0/mtgatracker-prod-EhDvLyq7PNb/public-api/anon-api-token",
            json: true,
            headers: {'User-Agent': 'MTGATracker-App'}
        }, (err, res, data) => {
          if (err || res.statusCode != 200) {
            errors.push({on: "get_token", error: err || res})
            resolve({attempt: attempt, errors: errors})
          } else {
            let token = data.token
            gameData.client_version = appData.version
            if (remote.getGlobal("incognito")) {  // we're not allowed to use this game data :(
              gameData = {anonymousUserID: crypto.createHash('md5').update(gameData.players[0].name).digest("hex")}
            }
            console.log("posting game request...")
            request.post({
              url: "https://wt.mtgatracker.com/wt-bd90f3fae00b1572ed028d0340861e6a-0/mtgatracker-prod-EhDvLyq7PNb/anon-api/game",
              json: true,
              body: gameData,
              headers: {'User-Agent': 'MTGATracker-App', token: token}
            }, (err, res, data) => {
              console.log("finished posting game request...")
              console.log(res)
              console.log(err)
              if (err || res.statusCode != 201) {
                errors.push({on: "post_game", error: err || res})
                resolve({attempt: attempt, errors: errors})
              } else {
                resolve({
                  success: true
                })
              }
            })
          }
        })
      }, delay)
    }
  }).then(result => {
    if (!result || !result.success) {
      return uploadGame(++attempt, gameData, result.errors)
    } else {
      return result
    }
  })
}

ws.onmessage = (data) => {
    // data is already parsed as JSON:
    data = JSON.parse(event.data)
    if(data.data_type == "game_state") {
        if (data.match_complete) {
            console.log("match over")
            if (data.game) {
              appData.game_complete = true;
              let uploadAttempt = 0
              uploadGame(uploadAttempt, data.game)
                .then(() => {
                  console.log("successfully uploaded game!")
                  if (!remote.getGlobal("incognito") && remote.getGlobal("showInspector")) {
                    appData.messages.push({text: "Game result sent to inspector!", mayfollow: "https://inspector.mtgatracker.com"})
                  }
                })
            }
        } else {
            appData.game_in_progress = true;
            appData.game_complete = false;
            appData.show_available_decklists = false;
            appData.draw_stats = data.draw_odds.stats;
            appData.deck_name = data.draw_odds.deck_name;
            appData.total_cards_in_deck = data.draw_odds.total_cards_in_deck;
            appData.opponent_hand = data.opponent_hand
        }

    } else if (data.data_type == "error") {
        if (data.count) {
            appData.error_count = data.count;
        }
        appData.last_error = data.msg;
    } else if (data.data_type == "message") {
        // TODO
    } else if (data.data_type=="decklist_change") {
        console.log("got a dl change")
        if (data.decks.no_decks_defined) {
            appData.no_decks = true;
        } else {
            new_decks = []
            $.each(data.decks, (key, value) => {
                new_decks.push(value)
            })
            appData.player_decks = new_decks;
            appData.no_decks = false;
        }
    }
    resizeWindow()
}

document.addEventListener("DOMContentLoaded", function(event) {
    if (debug || useFrame) {
        $("#container").addClass("container-framed")
        $("body").css("background-color", "green")
    } else {
        $("#container").addClass("container-normal")
    }
    $("#floating-settings").click(() => {
      ipcRenderer.send('openSettings', null)
    })
    $(".zoom-out").click(() => {
        zoom -= 0.1
        browserWindow.webContents.setZoomFactor(zoom)
    })
    $(".zoom-in").click(() => {
        zoom += 0.1
        browserWindow.webContents.setZoomFactor(zoom)
    })
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        shell.openExternal(this.href);
    });
});

ipcRenderer.on('themeChanged', (themeInfo) => {
  console.log("got theme changed")
  let useTheme = remote.getGlobal("useTheme")
  let themeFile = remote.getGlobal("themeFile")
  let currentThemeLink = $("#theme")
  if (currentThemeLink) {
    currentThemeLink.remove()
  }

  if (useTheme && themeFile) {
    let head  = document.getElementsByTagName('head')[0];
    let link  = document.createElement('link');
    link.id   = 'theme';
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = '../../../themes/' + themeFile; // ????? tbh
    head.appendChild(link)
  }
})

ipcRenderer.on('updateReadyToInstall', (messageInfo) => {
  console.log("got an update ready message")
  console.log(messageInfo)
  appData.messages.push({text: "A new tracker update will be applied on next launch!", mayfollow:"https://github.com/shawkinsl/mtga-tracker/releases/latest"})
})

console.timeEnd('init')