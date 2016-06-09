const fs = require('fs-extra')
const fetch = require('isomorphic-fetch')

const DBL_QUOTE = '"'
const COMMA = ','

getSystems()

function getSystems () {
  return fetch('https://raw.githubusercontent.com/NABSA/gbfs/master/systems.csv')
    .then((res) => res.text())
    .then((csv) => {
      // NOTE: fs-extra outputFileSync will create dirs that don't exist
      fs.outputFileSync('./gbfs/systems.csv', csv)
      csv
        .split('\n')
        .slice(1, -1)
        .map((row) => {
          const quotes = row.split(DBL_QUOTE)
          // FYI: breaks on non-double-quoted location
          //return [...quotes[0].slice(0, -1).split(','), quotes[1], ...quotes[2].slice(1).split(',')]
          if (quotes.length == 3) {
            // handle the case with double-quoted location:
            const first = quotes[0].split(COMMA)
            const last = quotes[2].split(COMMA)
            return [
              first[0],
              first[1],       // ignore last comma in first chunk
              quotes[1],  // use middle chunk from quotes split
              last[1],       // ignore first comma in last chunk
              last[2],
              last[3]
            ]
          } else {
            // standard un-quoted location
            return row.split(COMMA)
          }
        })
        .map((row) => {
          return {
            country: row[0],
            name: row[1],
            location: row[2],
            id: row[3],
            url: row[4],
            gbfs: row[5]
          }
        })
        .forEach((system) => {
          fetch(system.gbfs)
            .then((res) => res.json())
            .then((gbfs) => {
              write(system.id, 'gbfs', gbfs)
              Promise.all(gbfs.data.en.feeds.map((feed) => {
                return fetch(feed.url)
                  .then((res) => res.json())
                  .then((data) => write(system.id, feed.name, data))
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
    fs.outputFile(`./gbfs/${id}/${name}.json`, JSON.stringify(data, null, '\t'), (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
