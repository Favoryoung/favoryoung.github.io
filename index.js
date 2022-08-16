let data = {
    showCard: false,
    showPool: true,
    card: "",
    info: {
        Mine: {
            uid: "",
            room_info: {
                room_no: "",
                is_master: false,
                number: "",
                item: "",
            },
        },
        Room: {
            games: 0,
            room_no: "",
            master: "",
            player_num: 0,
            players: {},
            items: [],
        }
    },
    creInfo: {
        "room_no": "",
        "player_num": "",
        "items": "",
        "others": "",
    },
    join_room_no: ""
}

let app = new Vue({
    el: "#app",
    data: data,
    methods: {
        switchCardOrPool: switchCardOrPool,
        creRoom: creRoom,
        outRoom: outRoom,
        joinRoom: joinRoom,
        reStart: reStart,
        newCard: newCard,
        applyMaster: applyMaster,
        openMsg: openMsg,
        querySearch: querySearch,
        managePlayer: managePlayer
    }
})

let defaultPool = [
    {"value": "预言家 女巫 猎人 村民 村民  狼人 狼人 狼人"}
]
const BASE_PATH = "52.76.212.95:8080/game/"
const BASE_URL = "https://" + BASE_PATH

//[msg,type]
let realMsg = [];

let ws;

// 跨域 cookie
Vue.http.options.xhr = {withCredentials:true};
Vue.http.interceptors.push((request, next) => {
    request.credentials = true;
    next();
});

(function ping() {
    doGet('ping', function (id) {
        ws = new WebSocket("wss://" + BASE_PATH + "ws?u=" + id);//连接服务器
        ws.onmessage = function (event) {
            let info = JSON.parse(JSON.parse(event.data).content)
            if (info.Mine) {
                if (!data.info.Mine.room_info.room_no && info.Mine.room_info.room_no) {
                    openMsg("进入 [" + info.Mine.room_info.room_no + "]号房间")
                } else if (data.info.Room.games != info.Room.games) {
                    if (info.Mine.room_info.room_no) {
                        openMsg("游戏开始 ╰(￣▽￣)╭")
                        data.info = info
                        newCard()
                        return
                    } else {
                        if (realMsg.length > 0) {
                            openMsg(realMsg[0], realMsg[1])
                            realMsg = [];
                        } else {
                            openMsg('被踢出房间了 〒▽〒', 'warning')
                        }
                    }
                } else if (!data.info.Mine.room_info.is_master && info.Mine.room_info.is_master) {
                    openMsg("成为房主啦 ╰(￣▽￣)╭")
                } else if (data.info.Mine.room_info.is_master && !info.Mine.room_info.is_master) {
                    openMsg("您已经交出房主")
                }

                let itemChanges = data.info.Mine.room_info.item != info.Mine.room_info.item
                data.info = info
                if (itemChanges) {
                    newCard(!info.Mine.room_info.item)
                }
            } else if (info.func) {
                window[info.func](info.params);
            }
        }

        ws.onclose = function (event) {
            app.$message.error("已经与服务器断开连接\r\n当前连接状态：" + this.readyState);
        };

        ws.onerror = function (event) {
            app.$message.error("WebSocket异常！");
        };
    })
}())

function querySearch(queryString, cb) {
    let results = queryString ? defaultPool.filter(createFilter(queryString)) : defaultPool;
    // 调用 callback 返回建议列表的数据
    cb(results);
}

function createFilter(queryString) {
    return (restaurant) => {
        return (restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0);
    };
}

function managePlayer(param) {
    param = param.split(',')
    if (param[0] == 'kickOut') {
        kickOut(param[1])
    } else {
        setMaster(param[1])
    }
}

function openMsg(msg, type) {
    type = type ? type : 'success'
    app.$message({
        message: msg,
        type: type
    });
}

function switchCardOrPool(showCard) {
    let cardStatus;
    if (showCard === "on") {
        cardStatus = false
    } else if (showCard === "off") {
        cardStatus = true
    } else {
        cardStatus = data.showCard
    }

    if (cardStatus) {
        data.showCard = false
        setTimeout(() => {   //设置延迟执行
            data.showPool = true
        }, 300);
    } else {
        data.showPool = false
        setTimeout(() => {   //设置延迟执行
            data.showCard = true
        }, 300);
    }
}

//不传 off,1
function newCard(showBack) {
    let firstShow = showBack ? "on" : "off"
    switchCardOrPool(firstShow)
    setTimeout(() => {   //设置延迟执行
        data.card = data.info.Mine.room_info.item
        switchCardOrPool()
    }, 600);
}

function creRoom() {
    let data = creRoomData()
    doPost('room/new', data, function () {
        homePage()
    })
}

function homePage() {
    ws.send('homePage')
}

function reStart() {
    doPost('restart', null)
}

function outRoom() {
    realMsg = ['已退出房间', '']
    doPost('room/out')
}

/**
 * @param uid
 */
function setMaster(uid) {
    doPost('room/master/set', {uid: uid})
}

function kickOut(uid) {
    doPost('room/kick/out', {uid: uid})
}

function applyMaster() {
    if (!data.info.Mine.room_info.is_master) {
        doPost('room/master/apply', {}, function (content) {
            openMsg(content)
        })
    }
}

function handleMasterRequest(param) {
    let uid = param[0]
    for (let num in data.info.Room.players) {
        if (data.info.Room.players[num] == uid) {
            app.$confirm("" + num + '号玩家 请求成为房主,是否同意?', '收到请求', {
                confirmButtonText: '同意',
                cancelButtonText: '拒绝',
                type: 'warning'
            }).then(() => {
                setMaster(uid)
            })
        }
    }
}

function joinRoom() {
    doGet('room/join?room_no=' + data.join_room_no)
}

function doGet(url, successCallback) {
    Vue.http.get(BASE_URL + url).then(
        function (res) {
            let result = res.body
            if (!"errcode" in result) {
                app.$message.error("GET 响应异常")
            }
            if (0 !== result.errcode) {
                app.$message.error(result.errmsg)
            } else {
                successCallback && successCallback(result.content)
            }
        },
        function (res) {
            app.$message.error("GET 请求异常")
        }
    )
}

function doPost(url, data, successCallback) {
    Vue.http.post(BASE_URL + url, data).then(
        function (res) {
            let result = res.body
            if (!"errcode" in result) {
                app.$message.error("响应异常")
            }
            if (0 !== result.errcode) {
                app.$message.error(result.errmsg)
            } else {
                successCallback && successCallback(result.content)
            }
        },
        function (res) {
            app.$message.error("请求异常")
        }
    )
}

function creRoomData() {
    return {
        "room_no": data.creInfo.room_no,
        "player_num": parseInt(data.creInfo.player_num),
        "items": getCreItems(),
        "seconds": getCreSeconds()
    }
}

function getCreItems() {
    return data.creInfo.items.split(" ").filter((v) => {
        return v !== "";
    })
}

function getCreSeconds() {
    let others = data.creInfo.others.split(" ").filter((v) => {
        return v !== "";
    })

    for (let i = 0; i < others.length; i++) {
        if (0 == others[i].indexOf("s:")) {
            let s = others[i].slice(2)
            if (!isNaN(s)) {
                return parseInt(s)
            }
        }
    }

    return 10
}
