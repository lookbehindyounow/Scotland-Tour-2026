// This is a script to take a series of points from route_nodes.csv,
// feed them to osrm backend & format the linestring it responds with
// into generated_route_n.csv files for each route.
// can separate routes in route_nodes.csv by predecessing them with a line starting with "#"

const polyline=require("@mapbox/polyline"); // for decoding linestrings
const fs=require("node:fs"); // for reading & writing files

const loggin=false;

let routeNodes=[]; // array to contain routes as strings of lng,lat;lng,lat;lng,lat;...
let i=-1; // route counter
fs.readFileSync("./route_nodes.csv","utf-8")
.split("\n")
.forEach(line=>{
    if (line[0]!="#") { // if line not starting with "#"
        node=line.split(",");
        node[0]?routeNodes[i]+=`${node[1]},${node[0]};`:{};
        // ^takes lat,lng,whatever,else & appends it to route reformatted as lng,lat; if theres a lat there
    } else {
        routeNodes.push(""); // if line starts with "#", add a new string to routeNodes
        i++; // & increment route counter
        loggin?console.log(routeNodes):{};
    }
});
loggin?console.log("\nnode points (lats & lngs swapped): "+routeNodes):{};

getRoute(routeNodes);
async function getRoute(routeNodes) {
    for (let i=0;i<routeNodes.length;i++) { // for each route
        const linestring=await fetch(`http://localhost:5000/route/v1/driving/${routeNodes[i].slice(0,-1)}?overview=full`)
        .then(res=>res.json()) // ^send to osrm backend after removing trailing ";" (has to be running on port 5000 on same machine)
        .then(res=>{
            loggin?console.log(res):{};
            return res.routes[0].geometry; // get linestring
        });
        loggin?fs.writeFile(`./linestring_${i}.txt`,linestring,err=>console.log(`error writing linestring ${i} to file: ${err}`)):{};
        
        const route=polyline.decode(linestring); // convert to points of polyline (this is the squiggly map route, has lots of points)
        
        let csv=""; // convert array of points to csv
        for (let j=0;j<route.length;j++) {
            csv+=route[j]+"\n";
        }
        csv=csv.slice(0,-1); // remove trailing newline then write to file
        fs.writeFile(`./generated_route_${i}.csv`,csv,err=>loggin?console.log(`error writing route ${i} to csv: ${err}`):{});
    }
}