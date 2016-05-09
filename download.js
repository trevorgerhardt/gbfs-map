const fs = require('fs')
const fetch = require('isomorphic-fetch')

getSystems()

function getSystems () {
  return fetch('https://raw.githubusercontent.com/NABSA/gbfs/master/systems.csv')
    .then((res) => res.text())
    .then((csv) => {
      fs.writeFileSync('./gbfs/systems.csv', csv)
      csv
        .split('\n')
        .slice(1, -1)
        .map((row) => {
          const quotes = row.split('"')
          return [...quotes[0].slice(0, -1).split(','), quotes[1], ...quotes[2].slice(1).split(',')]
        })
        .map((row) => {
          return {
            country: row[0],
            gbfs: row[5],
            id: row[3],
            location: row[2],
            name: row[1],
            url: row[4]
          }
        })
        .forEach((system) => {
          if (!fs.existsSync(`./gbfs/${system.id}`)) fs.mkdirSync(`./gbfs/${system.id}`)
          fetch(system.gbfs)
            .then((res) => res.json())
            .then((gbfs) => {
              write(system.id, 'gbfs', gbfs)
              Promise.all(gbfs.data.en.feeds.map((feed) => {
                return fetch(feed.url)
                  .then((res) => res.json())
                  .then((data) => {
                    if (feed.name === 'station_information') {
                      return Promise.all([
                        write(system.id, 'geojson', gbfs2geojson(data)),
                        write(system.id, feed.name, data)
                      ])
                    }
                    return write(system.id, feed.name, data)
                  })
                  .catch((e) => {
                    console.error(e.stack)
                    throw e
                  })
              }))
            })
            .catch((e) => {
              console.error(e.stack)
              throw e
            })
        })
    })
    .catch((e) => {
      console.error(e.stack)
      throw e
    })
}

function write (id, name, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(`./gbfs/${id}/${name}.json`, JSON.stringify(data, null, '\t'), (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

function gbfs2geojson (station_information) {
  return {
    type: 'FeatureCollection',
    features: station_information.data.stations.map(function (station) {
      return {
        type: 'Feature',
        properties: station,
        geometry: {
          type: 'Point',
          coordinates: [
            station.lon,
            station.lat
          ]
        }
      }
    })
  }
}
