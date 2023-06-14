let express = require('express');

let app = express();
let port = 8006;

let server = require('http').createServer(app);
let compression = require('compression');
let crypto = require('crypto');
let mysql = require('mysql2');
let fs = require('fs');

const db_config = require('./src/db-config');
const password = JSON.parse(fs.readFileSync('./src/password.json', 'utf-8'));

let core = require('./src/core');


app.use(compression());
app.use(express.static('public')); // Set static file location
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const positionFinder = require('./src/core.js');



/*
테스트용 요청
단순히 들어온 json데이터를 다시 반환해준다.
json 데이터가 잘 전달됬는지 확인 가능
*/
app.post('/test', (req, res) => {
    console.log("/test")
    console.log(req.body);
    res.send(req.body);
});


/*
데이터셋을 추가하는 요청
json형태로 새로운 데이터를 전달받아 db에 insert해준다.
데이터는 아래와 같은 형식으로 전달해 주면 된다.
{
    "position" : "307호",
    "wifi_data" : [
        {
            "bssid" : 111,
            "rssi" : -60
        },
        {
            "bssid" : 112,
            "rssi" : -30
        },
        {
            "bssid" : 113,
            "rssi" : -55
        },
        {
            "bssid" : 114,
            "rssi" : -85
        },
        {
            "bssid" : 116,
            "rssi" : -88
        }
    ]
}
*/
app.post('/add', (req, res) => { // Default entry
    console.log(req.body);
    const [encrypted, salt] = password.key.split("$"); // splitting password and salt
    crypto.pbkdf2(req.body.password, salt, 65536, 64, 'sha512', (err, derivedKey) => { // Encrypting input password
        if (err) res.send({error: "encrypt error"});
        
        if (derivedKey.toString("hex") === encrypted) { // Check its same
            let db = mysql.createConnection(db_config);
            db.connect();
            db.query('insert into wifi_data(position, wifi_data) values(?, ?)', 
            [req.body.position, JSON.stringify(req.body.wifi_data)], (err, result) => {
                if(err) {
                    console.log(err);
                    return res.send({ msg: "error" });
                }
                db.end();
    
                let res_data = { 
                    msg: "success",
                    insertId: result.insertId
                };

               first = true
    
                console.log("res_data : ", res_data);
                return res.send(res_data);
            });
        }
        else {
            res.send({error: "incorrect password"});
        }
    });//pbkdf2
});


/*
위치를 찾아주는 요청
현재 위치의 와이파이 신호 데이터를 전달하면 예상되는 위치를 반환해준다.
위치 추정은 ./src/core.js에 정의된 함수에서 계산한다.
데이터 형태는 add와 비슷하지만 위치를 모르는 상태이니 position값은 빼주면 된다.
{
    "position" : "",
    "wifi_data" : [
        {
            "bssid" : 111,
            "rssi" : -60
        },
        {
            "bssid" : 112,
            "rssi" : -30
        },
        {
            "bssid" : 113,
            "rssi" : -55
        },
        {
            "bssid" : 114,
            "rssi" : -85
        },
        {
            "bssid" : 116,
            "rssi" : -88
        }
    ]
}
*/
app.post('/findPosition', (req, res) => {
    //console.log("/findPosition");
    //console.log(req.body);

      positionFinder.findPosition(req, res);

});

app.post('/dijkstra', (req, res) => {
    const data1 = req.body.start;
    const data2 = req.body.end;
    
    const { distancePath, path, direction } = getPathDescription(data1, data2);
    
    res.send({
      distance: distancePath,
      path: path,
      direction: direction
  });
});

class Graph {
  constructor() {
    this.edges = {}; // 연결 정보를 저장할 객체
  }

  addEdge(source, destination, weight) {
    // 간선 정보를 추가하는 메서드
    if (!this.edges[source]) {
      this.edges[source] = {};
    }
    this.edges[source][destination] = weight;

    if (!this.edges[destination]) {
      this.edges[destination] = {};
    }
      this.edges[destination][source] = weight;
    
  }

  addNode(node) {
    // 노드를 추가하는 메서드
    if (!this.edges[node]) {
      this.edges[node] = {};
    }
  }

  getDistance(source, destination) {
    if (!this.edges[source] || !this.edges[destination]) {
      return -1; // 노드가 존재하지 않는 경우 -1 반환
    }
    
    const queue = [];
    const visited = new Set();
    const distance = {};

    queue.push(source);
    distance[source] = 0;

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === destination) {
        return distance[current]; // 목적지에 도달한 경우 거리 반환
      }

      visited.add(current);

      for (const neighbor in this.edges[current]) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
          distance[neighbor] = distance[current] + this.edges[current][neighbor];
        }
      }
    }

    return -1; // 목적지에 도달할 수 없는 경우 -1 반환
  }

}

const graph = new Graph();

// 다익스트라 알고리즘 함수 (시작과 끝 노드 고려)
function dijkstra(graph, start, end) {
const distances = {};
const visited = new Set();
const unvisited = new Set(Object.keys(graph.edges));
const previous = {};

// 시작 노드의 거리를 Infinity로 초기화
Object.keys(graph.edges).forEach((node) => {
  distances[node] = Infinity;
});

// 시작 노드의 거리를 0으로 초기화
distances[start] = 0;

// 가장 가까운 노드를 선택하는 함수
function getClosestNode(unvisited, distances) {
  let closestNode;
  for (const node of unvisited) {
    if (distances[node] !== Infinity) {
      if (!closestNode) {
        closestNode = node;
      } else if (distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    }
  }
  return closestNode;
}

while (unvisited.size > 0) {
  // 현재까지의 최단 거리를 가진 노드를 선택
  const currentNode = getClosestNode(unvisited, distances);
  unvisited.delete(currentNode);
  visited.add(currentNode);

  // 도착 노드에 도달하면 반복 종료
  if (currentNode === end) {
    break;
  }

  // 현재 노드와 연결된 노드들의 거리를 업데이트
  for (const neighbor in graph.edges[currentNode]) {
    if (!visited.has(neighbor)) {
      const distance = distances[currentNode] + graph.edges[currentNode][neighbor];
      if (distance < distances[neighbor]) {
        distances[neighbor] = distance;
        previous[neighbor] = currentNode;
      }
    }
  }
}

// 최단 경로 추적
const path = [end];
let currentNode = end;
let distancePath = []; // 노드 간의 거리를 저장하는 배열

while (currentNode !== start) {
  const prevNode = previous[currentNode];
  const distance = graph.edges[prevNode][currentNode];
  path.unshift(prevNode);
  distancePath.unshift(distance);
  currentNode = prevNode;
}

return {
  distances,
  path,
  distancePath
};
}


// 예시 그래프 생성
graph.addNode("401호");
graph.addNode("402호");
graph.addNode("403호");
graph.addNode("404호");
graph.addNode("405호");
graph.addNode("406호");
graph.addNode("407호");
graph.addNode("407호 - KEA 라운지");
graph.addNode("408호");
graph.addNode("409호");
graph.addNode("410호");
graph.addNode("411호 - KEA");
graph.addNode("412호");
graph.addNode("413호");
graph.addNode("414호");
graph.addNode("415호");
graph.addNode("416호");
graph.addNode("417호");
graph.addNode("418호");
graph.addNode("419호");
graph.addNode("420호");
graph.addNode("421호");
graph.addNode("422호");
graph.addNode("423호");
graph.addNode("424호");
graph.addNode("425호");
graph.addNode("426호");
graph.addNode("427호");
graph.addNode("428호");
graph.addNode("429호");
graph.addNode("430호");
graph.addNode("431호");
graph.addNode("432호");
graph.addNode("433호");
graph.addNode("434호");
graph.addNode("435호");
graph.addNode("4층 아르테크네");
graph.addNode("4층 제 1 엘리베이터");
graph.addNode("4층 제 2 엘리베이터 1호");
graph.addNode("4층 제 2 엘리베이터 2호");
graph.addNode("4층 제 3 엘리베이터 1호");
graph.addNode("4층 제 3 엘리베이터 2호");
graph.addNode("4층 제 1 계단");
graph.addNode("4층 제 2 계단");
graph.addNode("4층 제 3 계단");
graph.addNode("4층 제 4 계단");
graph.addNode("4층 제 5 계단");
graph.addNode("4층 제 1 여자화장실");
graph.addNode("4층 제 1 남자화장실");
graph.addNode("4층 제 2 여자화장실");
graph.addNode("4층 제 2 남자화장실");
graph.addNode("4층 여자 장애인 화장실");
graph.addNode("4층 남자 장애인 화장실");

graph.addNode("4층 테라스");
graph.addEdge("4층 제 2 엘리베이터 1호", "4층 테라스", 5);
graph.addEdge("4층 제 2 엘리베이터 2호", "4층 테라스", 5);

graph.addEdge("401호", "402호", 4);
graph.addEdge("402호", "403호", 5);
graph.addEdge("403호", "404호", 10);
graph.addEdge("404호", "405호", 10);
graph.addEdge("405호", "406호", 10);

graph.addEdge("406호", "4층 제 3 계단", 6);
graph.addEdge("406호", "407호", 7);
graph.addEdge("407호", "407호 - KEA 라운지", 13);
graph.addEdge("407호", "4층 제 3 계단", 3);

graph.addEdge("408호", "407호", 6.5);
graph.addEdge("407호", "408호", 1);

graph.addEdge("408호", "409호", 6.5);
graph.addEdge("409호", "410호", 6.5);
graph.addEdge("410호", "411호 - KEA", 6.5);
graph.addEdge("411호 - KEA", "4층 제 4 계단", 2.5);
graph.addEdge("4층 제 4 계단", "412호" ,2.5);
graph.addEdge("412호", "413호", 10);
graph.addEdge("413호", "414호", 10);
graph.addEdge("414호", "415호", 10);
graph.addEdge("415호", "4층 제 5 계단", 10);
graph.addEdge("4층 제 5 계단", "416호", 2);
graph.addEdge("416호", "4층 제 5 계단", 4);
graph.addEdge("416호", "417호", 3.3);
graph.addEdge("417호", "418호", 3.3);
graph.addEdge("418호", "419호", 3.3);
graph.addEdge("419호", "420호", 3.3);
graph.addEdge("419호", "4층 제 2 엘리베이터 1호", 5);

graph.addEdge("421호", "422호", 3.3);
graph.addEdge("423호", "424호", 3.3);
graph.addEdge("424호", "425호", 3.3);
graph.addEdge("425호", "4층 아르테크네", 3.3);
graph.addEdge("4층 아르테크네", "4층 제 1 엘리베이터", 4);
graph.addEdge("4층 제 1 엘리베이터", "4층 제 1 계단", 2);
graph.addEdge("4층 제 1 계단", "426호", 1);
graph.addEdge("426호", "427호", 3.3);
graph.addEdge("427호", "428호", 3.3);
graph.addEdge("428호", "429호", 3.3);
graph.addEdge("429호", "430호", 3.3);
graph.addEdge("430호", "431호", 3.3);
graph.addEdge("431호", "432호", 3.3);
graph.addEdge("432호", "433호", 3.3);
graph.addEdge("433호", "434호", 3.3);
graph.addEdge("434호", "435호", 3.3);
graph.addEdge("435호", "4층 제 2 계단", 5);
graph.addEdge("4층 제 2 계단", "435호", 3);
graph.addEdge("4층 제 2 계단", "401호", 1);

//화장실, 계단, 엘레베이터

graph.addEdge("4층 제 1 여자화장실", "429호", 2.7);
graph.addEdge("4층 제 1 여자화장실", "430호", 2.5);

graph.addEdge("4층 제 1 남자화장실", "423호", 2.5);
graph.addEdge("4층 제 1 남자화장실", "422호", 3);
graph.addEdge("4층 제 1 남자화장실", "4층 남자 장애인 화장실", 5);
graph.addEdge("4층 남자 장애인 화장실", "4층 여자 장애인 화장실", 4);
graph.addEdge("4층 남자 장애인 화장실", "421호", 2);
graph.addEdge("4층 남자 장애인 화장실", "422호", 2);
graph.addEdge("4층 남자 장애인 화장실", "420호", 4);

graph.addEdge("4층 여자 장애인 화장실", "420호", 2);
graph.addEdge("4층 여자 장애인 화장실", "421호", 2);



graph.addEdge("4층 제 2 여자화장실", "408호", 3.5);
graph.addEdge("4층 제 2 남자화장실", "408호", 3.5);
graph.addEdge("408호", "4층 제 2 남자화장실", 7);

graph.addEdge("4층 제 2 여자화장실", "409호", 4);
graph.addEdge("4층 제 2 남자화장실", "409호", 3.5);

graph.addEdge("4층 제 2 여자화장실", "4층 제 3계단", 2);
graph.addEdge("4층 제 2 남자화장실", "410호", 4);
graph.addEdge("410호", "4층 제 2 남자화장실", 7);

graph.addEdge("4층 제 3 계단", "408호", 3);



graph.addEdge("434호", "4층 제 2 엘리베이터 2호", 4);
graph.addEdge("426호", "4층 아르테크네", 7);
graph.addEdge("426호", "425호", 7);
graph.addEdge("425호", "4층 제 1 계단", 6);


graph.addEdge("4층 제 2 엘리베이터 1호", "418호", 3);
graph.addEdge("4층 제 2 엘리베이터 2호", "433호", 3);
graph.addEdge("4층 제 2 엘리베이터 1호", "4층 제 2 엘리베이터 2호", 1);


graph.addEdge("4층 제 3 엘리베이터 1호", "4층 제 3 엘리베이터 2호", 1);
graph.addEdge("4층 제 3 엘리베이터 1호", "410호", 4);
graph.addEdge("4층 제 3 엘리베이터 1호", "409호", 5);
graph.addEdge("4층 제 3 엘리베이터 1호", "411호 - KEA", 7);
graph.addEdge("4층 제 3 엘리베이터 1호", "4층 제 4 계단", 7);

graph.addEdge("4층 제 3 엘리베이터 2호", "412호", 6);
graph.addEdge("4층 제 3 엘리베이터 2호", "413호", 7);

graph.addEdge("4층 제 3 엘리베이터 2호", "405호", 22);
graph.addEdge("4층 제 3 엘리베이터 2호", "404호", 23);
graph.addEdge("404호", "4층 제 3 엘리베이터 2호", 33);
graph.addEdge("412호", "4층 제 3 엘리베이터 2호", 7);

// 4층 5층 연결
// graph.addEdge("4층 제 1 엘리베이터", "5층 제 1 엘리베이터", 4);
// graph.addEdge("4층 제 2 엘리베이터 1호", "5층 제 2 엘리베이터 1호", 4);
// graph.addEdge("4층 제 2 엘리베이터 2호", "5층 제 2 엘리베이터 2호", 4);
// graph.addEdge("4층 제 3 엘리베이터 1호", "5층 제 3 엘리베이터 1호", 4);
// graph.addEdge("4층 제 3 엘리베이터 2호", "5층 제 3 엘리베이터 2호", 4);
// graph.addEdge("4층 제 1 엘리베이터", "5층 제 1 엘리베이터", 4);

// graph.addEdge("4층 제 1 계단", "5층 제 1 계단", 8);
// graph.addEdge("4층 제 2 계단", "5층 제 2 계단", 8);
// graph.addEdge("4층 제 3 계단", "5층 제 3 계단", 8);
// graph.addEdge("4층 제 4 계단", "5층 제 4 계단", 8);
// graph.addEdge("4층 제 5 계단", "5층 제 5 계단", 8);
// 연결



// 예시 그래프 생성
graph.addNode("501호");
graph.addNode("502호");
graph.addNode("503호");
graph.addNode("504호");
graph.addNode("505호");
graph.addNode("506호");
graph.addNode("507호");
graph.addNode("IT융합대학 조교실");
graph.addNode("508호");
graph.addNode("509호");
graph.addNode("510호");
graph.addNode("511호");
graph.addNode("512호");
graph.addNode("513호");
graph.addNode("514호");
graph.addNode("515호");
graph.addNode("516호");
graph.addNode("517호");
graph.addNode("518호");
graph.addNode("519호");
graph.addNode("520호");
graph.addNode("521호");
graph.addNode("522호");
graph.addNode("523호");
graph.addNode("524호");
graph.addNode("525호");
graph.addNode("526호");
graph.addNode("527호");
graph.addNode("528호");
graph.addNode("529호");
graph.addNode("530호");
graph.addNode("531호");
graph.addNode("532호");
graph.addNode("533호");
graph.addNode("534호");
graph.addNode("535호");
graph.addNode("5층 아르테크네");
graph.addNode("5층 제 1 엘리베이터");
graph.addNode("5층 제 2 엘리베이터 1호");
graph.addNode("5층 제 2 엘리베이터 2호");
graph.addNode("5층 제 3 엘리베이터 1호");
graph.addNode("5층 제 3 엘리베이터 2호");
graph.addNode("5층 제 1 계단");
graph.addNode("5층 제 2 계단");
graph.addNode("5층 제 3 계단");
graph.addNode("5층 제 4 계단");
graph.addNode("5층 제 5 계단");
graph.addNode("5층 제 1 여자화장실");
graph.addNode("5층 제 1 남자화장실");
graph.addNode("5층 제 2 여자화장실");
graph.addNode("5층 제 2 남자화장실");
graph.addNode("5층 여자 장애인 화장실");
graph.addNode("5층 남자 장애인 화장실");
graph.addNode("5층 큐브 입구 1");
graph.addNode("5층 큐브 입구 2");


graph.addEdge("501호", "502호", 4);
graph.addEdge("502호", "503호", 5);
graph.addEdge("503호", "504호", 10);

graph.addEdge("503호", "5층 큐브 입구 1", 2);

graph.addEdge("504호", "505호", 10);
graph.addEdge("505호", "506호", 10);

graph.addEdge("506호", "5층 제 3 계단", 6);
graph.addEdge("506호", "507호", 7);
graph.addEdge("507호", "IT융합대학 조교실", 13);
graph.addEdge("507호", "5층 제 3 계단", 3);

graph.addEdge("507호", "508호", 1);
graph.addEdge("508호", "507호", 6.5);

graph.addEdge("508호", "509호", 6.5);
graph.addEdge("509호", "510호", 6.5);
graph.addEdge("510호", "511호", 6.5);
graph.addEdge("511호", "5층 제 4 계단", 2.5);
graph.addEdge("5층 제 4 계단", "512호" ,2.5);
graph.addEdge("512호", "513호", 10);
graph.addEdge("513호", "514호", 3.5);

graph.addEdge("514호", "515호", 4.5);
graph.addEdge("515호", "5층 큐브 입구 2", 3);
graph.addEdge("515호", "5층 큐브 입구 2", 2);

graph.addEdge("5층 큐브 입구 1", "5층 큐브 입구 2", 12);




graph.addEdge("515호", "516호", 5);
graph.addEdge("516호", "517호", 3);
graph.addEdge("517호", "518호", 3);
graph.addEdge("518호", "5층 제 5 계단", 5.5);
graph.addEdge("5층 제 5 계단", "519호", 2.5);
graph.addEdge("519호", "520호", 3);
graph.addEdge("520호", "521호", 5.5);
graph.addEdge("521호", "522호", 3.2);
graph.addEdge("522호", "523호", 5.5);
graph.addEdge("523호", "524호", 3.2);
graph.addEdge("524호", "525호", 5.5);
graph.addEdge("525호", "5층 아르테크네", 3);
graph.addEdge("5층 아르테크네", "5층 제 1 엘리베이터", 3);
graph.addEdge("5층 제 1 엘리베이터", "5층 제 1 계단", 2);
graph.addEdge("5층 제 1 계단", "526호", 1);
graph.addEdge("526호", "527호", 3.3);
graph.addEdge("527호", "528호", 5);
graph.addEdge("528호", "529호", 3.3);
graph.addEdge("529호", "530호", 5);
graph.addEdge("530호", "531호", 3.3);
graph.addEdge("531호", "532호", 3.5);
graph.addEdge("532호", "5층 제 2 계단", 5)
graph.addEdge("5층 제 2 계단", "532호", 3);
graph.addEdge("5층 제 2 계단", "501호", 1);

//화장실, 계단, 엘레베이터

graph.addEdge("5층 제 1 여자화장실", "529호", 2.7);
graph.addEdge("5층 제 1 여자화장실", "530호", 2.5);

graph.addEdge("5층 제 1 남자화장실", "523호", 2.5);
graph.addEdge("5층 제 1 남자화장실", "522호", 3);
graph.addEdge("5층 제 1 남자화장실", "5층 남자 장애인 화장실", 5);
graph.addEdge("5층 남자 장애인 화장실", "5층 여자 장애인 화장실", 4);
graph.addEdge("5층 남자 장애인 화장실", "521호", 2);
graph.addEdge("5층 남자 장애인 화장실", "522호", 2);
graph.addEdge("5층 남자 장애인 화장실", "520호", 4);

graph.addEdge("5층 여자 장애인 화장실", "520호", 2);
graph.addEdge("5층 여자 장애인 화장실", "521호", 2);



graph.addEdge("5층 제 2 여자화장실", "508호", 3.5);
graph.addEdge("5층 제 2 남자화장실", "508호", 3.5);

graph.addEdge("510호", "5층 제 2 남자화장실", 7);

graph.addEdge("5층 제 2 여자화장실", "509호", 4);
graph.addEdge("5층 제 2 남자화장실", "509호", 3.5);
graph.addEdge("510호", "5층 제 2 남자화장실", 7);

graph.addEdge("5층 제 2 여자화장실", "5층 제 3계단", 2);
graph.addEdge("5층 제 2 남자화장실", "450호", 4);
graph.addEdge("510호", "5층 제 2 남자화장실", 4);

graph.addEdge("5층 제 3 계단", "508호", 3);

graph.addEdge("534호", "5층 제 2 엘리베이터 2호", 4);
graph.addEdge("526호", "5층 아르테크네", 8);
graph.addEdge("526호", "525호", 7);
graph.addEdge("525호", "5층 제 1 계단", 6);



graph.addEdge("5층 제 2 엘리베이터 1호", "518호", 3);
graph.addEdge("5층 제 2 엘리베이터 2호", "533호", 3);
graph.addEdge("5층 제 2 엘리베이터 1호", "5층 제 2 엘리베이터 2호", 1);


graph.addEdge("5층 제 3 엘리베이터 1호", "5층 제 3 엘리베이터 2호", 1);
graph.addEdge("5층 제 3 엘리베이터 1호", "510호", 4);
graph.addEdge("5층 제 3 엘리베이터 1호", "509호", 6);
graph.addEdge("5층 제 3 엘리베이터 1호", "511호", 7);
graph.addEdge("5층 제 3 엘리베이터 1호", "5층 제 4 계단", 7);

graph.addEdge("5층 제 3 엘리베이터 2호", "512호", 6);
graph.addEdge("5층 제 3 엘리베이터 2호", "513호", 7.2);

graph.addEdge("5층 제 3 엘리베이터 2호", "505호", 22);
graph.addEdge("5층 제 3 엘리베이터 2호", "504호", 23);
graph.addEdge("504호", "5층 제 3 엘리베이터 2호", 33);
graph.addEdge("512호", "5층 제 3 엘리베이터 2호", 7);

const map = new Map();

//좌회전
map['4층 제 3 엘리베이터 2호:405호'] = "-1"
map['4층 제 3 엘리베이터 1호:4층 제 3 엘리베이터 2호'] = "-1"
map['4층 제 3 계단:406호'] = "-1"
map['406호:4층 제 3 엘리베이터 2호'] = "-1"
map['407호:406호'] = "-1"
map['411호:410호'] = "-1"
map['4층 제 3 엘리베이터 2호:412호'] = "-1"
map['412호:4층 제 3 엘리베이터 2호'] = "-1"
map['4층 제 2 엘리베이터 2호:433호'] = "-1"
map['4층 제 3 엘리베이터 2호:413호'] = "-1"

map['4층 제 2 엘리베이터 1호:418호'] = "-1"
map['434호:4층 제 2 엘리베이터 2호'] = "-1"
map['419호:4층 제 2 엘리베이터 1호'] = "-1"
map['426호:4층 아르테크네'] = "-1"
map['426호:425호'] = "-1"
map['4층 제 1 계단:425호'] = "-1"

map['5층 제 3 엘리베이터 2호:505호'] = "-1"
map['5층 제 3 엘리베이터 1호:5층 제 3 엘리베이터 2호'] = "-1"
map['5층 제 3 계단:506호'] = "-1"
map['506호:5층 제 3 엘리베이터 2호'] = "-1"
map['507호:506호'] = "-1"
map['511호:510호'] = "-1"
map['5층 제 3 엘리베이터 2호:512호'] = "-1"
map['512호:5층 제 3 엘리베이터 2호'] = "-1"
map['5층 제 2 엘리베이터 2호:533호'] = "-1"
map['5층 제 2 엘리베이터 1호:518호'] = "-1"
map['534호:5층 제 2 엘리베이터 2호'] = "-1"
map['519호:5층 제 2 엘리베이터 1호'] = "-1"
map['526호:5층 아르테크네'] = "-1"
map['526호:525호'] = "-1"
map['5층 제 1 계단:525호'] = "-1"
map['514호:503호'] = "-1"
map['514호:504호'] = "-1"
map['504호:513호'] = "-1"
map['504호:514호'] = "-1"


//우회전
map['4층 제 3 엘리베이터 2호:406호'] = "1"
map['4층 제 3 엘리베이터 2호:4층 제 3 엘리베이터 1호'] = "1"
map['4층 제 3 엘리베이터 1호:410호'] = "1"
map['4층 제 3 엘리베이터 1호:411호'] = "1"
map['4층 제 3 엘리베이터 1호:411호 - KEA'] = "1"
map['4층 제 3 엘리베이터 1호:4층 제 4 계단'] = "1"
map['404호:4층 제 3 엘리베이터 2호'] = "1"
map['433호:4층 제 2 엘리베이터 2호'] = "1"
map['418호:4층 제 2 엘리베이터 1호'] = "1"
map['4층 아르테크네:426호'] = "1"
map['425호:426호'] = "1"
map['425호:4층 제 1 계단'] = "1"
map['4층 제 2 엘리베이터 2호:434호'] = "1"
map['409호:4층 제 3 엘리베이터 1호'] = "1"



map['5층 제 3 엘리베이터 2호:506호'] = "1"
map['5층 제 3 엘리베이터 2호:5층 제 3 엘리베이터 1호'] = "1"
map['5층 제 3 엘리베이터 1호:510호'] = "1"
map['5층 제 3 엘리베이터 1호:511호'] = "1"
map['5층 제 3 엘리베이터 1호:5층 제 4 계단'] = "1"
map['504호:5층 제 3 엘리베이터 2호'] = "1"
map['533호:5층 제 2 엘리베이터 2호'] = "1"
map['518호:5층 제 2 엘리베이터 1호'] = "1"
map['5층 아르테크네:526호'] = "1"
map['525호:526호'] = "1"
map['525호:5층 제 1 계단'] = "1"
map['513호:504호'] = "1"
map['513호:503호'] = "1"
map['503호:513호'] = "1"
map['503호:514호'] = "1"
map['509호:5층 제 3 엘리베이터 1호'] = "1"

var node_artechne411 = [];

node_artechne411[0] = '4층 아르테크네';
node_artechne411[1] = '425호';
node_artechne411[2] = '424호';
node_artechne411[3] = '423호';
node_artechne411[4] = '422호';
node_artechne411[5] = '421호';
node_artechne411[6] = '420호';
node_artechne411[7] = '419호';
node_artechne411[8] = '418호';
node_artechne411[9] = '417호';
node_artechne411[10] = '416호';
node_artechne411[11] = '4층 제 5 계단';
node_artechne411[12] = '415호';
node_artechne411[13] = '414호';
node_artechne411[14] = '413호';
node_artechne411[15] = '412호';
node_artechne411[16] = '411호 - KEA';

var node_artechne511 = [];

node_artechne511[0] = '5층 아르테크네';
node_artechne511[1] = '525호';
node_artechne511[2] = '524호';
node_artechne511[3] = '523호';
node_artechne511[5] = '522호';
node_artechne511[5] = '521호';
node_artechne511[6] = '520호';
node_artechne511[7] = '519호';
node_artechne511[8] = '518호';
node_artechne511[9] = '517호';
node_artechne511[10] = '516호';
node_artechne511[11] = '5층 제 5 계단';
node_artechne511[12] = '515호';
node_artechne511[13] = '514호';
node_artechne511[15] = '513호';
node_artechne511[15] = '512호';
node_artechne511[16] = '511호';

var node_elevetor407 = [];

node_elevetor407[0] = '4층 제 1 엘리베이터';
node_elevetor407[1] = '426호';
node_elevetor407[2] = '427호';
node_elevetor407[3] = '428호';
node_elevetor407[4] = '429호';
node_elevetor407[5] = '430호';
node_elevetor407[6] = '431호';
node_elevetor407[7] = '432호';
node_elevetor407[8] = '433호';
node_elevetor407[9] = '434호';
node_elevetor407[10] = '435호';
node_elevetor407[11] = '4층 제 2 계단';
node_elevetor407[12] = '401호';
node_elevetor407[13] = '402호';
node_elevetor407[14] = '403호';
node_elevetor407[15] = '404호';
node_elevetor407[16] = '405호';
node_elevetor407[17] = '406호';
node_elevetor407[18] = '407호';

var node_elevetor507 = [];

node_elevetor507[0] = '5층 제 1 엘리베이터';
node_elevetor507[1] = '526호';
node_elevetor507[2] = '527호';
node_elevetor507[3] = '528호';
node_elevetor507[4] = '529호';
node_elevetor507[5] = '530호';
node_elevetor507[6] = '531호';
node_elevetor507[7] = '532호';
node_elevetor507[8] = '533호';
node_elevetor507[9] = '534호';
node_elevetor507[10] = '535호';
node_elevetor507[11] = '5층 제 2 계단';
node_elevetor507[12] = '501호';
node_elevetor507[13] = '502호';
node_elevetor507[14] = '503호';
node_elevetor507[15] = '504호';
node_elevetor507[16] = '505호';
node_elevetor507[17] = '506호';
node_elevetor507[18] = '507호';

var node_407411 = [];

node_407411[0] = '407호 - KEA 라운지';
node_407411[1] = '407호';
node_407411[2] = '408호';
node_407411[3] = '409호';
node_407411[4] = '410호';
node_407411[5] = '411호 - KEA';

var node_507511 = [];

node_507511[0] = 'IT융합대학 조교실';
node_507511[1] = '507호';
node_507511[2] = '508호';
node_507511[3] = '509호';
node_507511[4] = '510호';
node_507511[5] = '511호';



function findDirection(start, next){

  // start와 next가 같은 배열의 원소인지 확인
  if(node_artechne411.includes(start) && node_artechne411.includes(next)){
    
    if(node_artechne411.indexOf(start) < node_artechne411.indexOf(next)){
      return '방위80';
    }else{
      return '방위260';
    }
  
  }else if(node_artechne511.includes(start) && node_artechne511.includes(next)){

    if(node_artechne511.indexOf(start) < node_artechne511.indexOf(next)){
      return '방위80';
    }else{
      return '방위260';
    }

  }else if(node_elevetor407.includes(start) && node_elevetor407.includes(next)){

    if(node_elevetor407.indexOf(start) < node_elevetor407.indexOf(next)){
      return '방위60';
    }else{
      return '방위240';
    }

  }else if(node_elevetor507.includes(start) && node_elevetor507.includes(next)){
    
    if(node_elevetor507.indexOf(start) < node_elevetor507.indexOf(next)){
      return '방위60';
    }else{
      return '방위240';
    }

  }else if(node_407411.includes(start) && node_407411.includes(next)){

    if(node_407411.indexOf(start) < node_407411.indexOf(next)){
      return '방위350';
    }else{
      return '방위170';
    }

  }else if(node_507511.includes(start) && node_507511.includes(next)){

    if(node_507511.indexOf(start) < node_507511.indexOf(next)){
      return '방위350';
    }else{
      return '방위170';
    }

  }else{
    return '0';
  }

};



function getPathDescription(start, end){
  // 다익스트라 알고리즘 실행
  const { distances, path, distancePath } = dijkstra(graph, start, end);
  //console.log("Distances:", distances);
  
  const direction = [];

  const description = [];

  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const nextNode = path[i + 1];
  
    const key = node + ":" + nextNode;
    
    var value = map[key] || "0";
    if(i>0 && node == "4층 제 3 엘리베이터 2호" && path[i-1] == "4층 제 3 엘리베이터 1호") {
      value = "1";
    }
    if(i>0 && node == "5층 제 3 엘리베이터 2호" && path[i-1] == "5층 제 3 엘리베이터 1호") {
      value = "1";
    }
    if(i>0 && node == "405호" && path[i-1] == "4층 제 3 엘리베이터 2호"&& nextNode == "404호") {
      value = "-1";
    }
    if(i>0 && node == "405호" && path[i-1] == "4층 제 3 엘리베이터 2호"&& nextNode == "406호") {
      value = "1";
    }
    if(i>0 && node == "505호" && path[i-1] == "5층 제 3 엘리베이터 2호"&& nextNode == "504호") {
      value = "-1";
    }
    if(i>0 && node == "505호" && path[i-1] == "5층 제 3 엘리베이터 2호"&& nextNode == "506호") {
      value = "1";
    }
    if(i>0 && node == "514호" && path[i-1] == "5층 제 3 엘리베이터 2호"&& nextNode == "506호") {
        value = "1";
    }
    if(i>0 && node == "503호" && path[i-1] == "504호"&& nextNode == "5층 큐브 입구 1") {
        value = "-1";
    }
    if(i>0 && node == "503호" && path[i-1] == "502호"&& nextNode == "5층 큐브 입구 1") {
        value = "1";
    }
    if(i>0 && node == "515호" && path[i-1] == "514호"&& nextNode == "5층 큐브 입구 2") {
        value = "1";
    }
    if(i>0 && node == "515호" && path[i-1] == "516호"&& nextNode == "5층 큐브 입구 2") {
        value = "-1";
    }

    //console.log("----------------------" + map[key], value);
    direction[i] = value;

    var direction_description = "";
    //console.log("findDirection(node, nextNode)",findDirection(node, nextNode)+"ggfgfgfgfgf");    

    if(value == "1" || value == "-1" || findDirection(node, nextNode) == '0'){

      if(value == "0"){
        direction_description = "직진";
      }else if(value  == "1"){
        direction_description = "우회전";
      }else if(value == "-1"){
      direction_description = "좌회전"
      }
  }else{

    direction[i] = findDirection(node, nextNode);
    direction_description = findDirection(node, nextNode);
  }
    description[i] = node + " -> " + nextNode + " : "+direction_description
  
    if (i + 1 === path.length - 1) {
      break;
    }
  }

console.log("———", distancePath, path, direction, description);
return {distancePath, path, direction};
}

server.listen(port, () => { // Open server
    console.log(`Listening on http://localhost:${port}/`);
});