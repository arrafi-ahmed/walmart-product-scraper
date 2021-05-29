require("dotenv").config()
const axios = require("axios")
const xlsx = require("xlsx")

//input from input.xlsx
let wb = xlsx.readFile("input-SKU.xlsx")
let ws = wb.Sheets["Sheet1"]
let products = xlsx.utils.sheet_to_json(ws)

if (products.length == 0) {
  console.log("Product input empty")
  return
}
//generate uuid
const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
const client_id = process.env.CLIENT_ID
const client_secret = process.env.CLIENT_SECRET
const authorization =
  "Basic " + Buffer.from(client_id + ":" + client_secret).toString("base64")

const data = "grant_type=client_credentials"
const headers = {
  Authorization: authorization,
  "WM_QOS.CORRELATION_ID": uuidv4(),
  "WM_SVC.NAME": "Walmart Marketplace",
  "Content-Type": "application/x-www-form-urlencoded",
}

const tempProducts = []
// create token
axios
  .post("https://marketplace.walmartapis.com/v3/token", data, { headers })
  .then((response) => {
    const headersT = {
      Authorization: authorization,
      "WM_SEC.ACCESS_TOKEN": response.data.access_token,
      "WM_QOS.CORRELATION_ID": uuidv4(),
      "WM_SVC.NAME": "Walmart Marketplace",
    }
    //fetch data sequentially
    ;(async () => {
      await Promise.all(
        products.map((product, index) => {
          return axios
            .get(
              `https://marketplace.walmartapis.com/v3/items/${product.SKU}`,
              {
                headers: headersT,
              }
            )
            .then((response) => {
              if (response.data.totalItems > 0) {
                const {
                  sku,
                  productName,
                  price: { amount },
                } = response.data.ItemResponse[0]
                const processedProduct = { index, sku, productName, amount }
                tempProducts.push(processedProduct)
                console.log(`${index} -- ${product.SKU} added`)
              } else {
                console.log("Invalid response")
              }
            })
            .catch((error) => {
              const errorProduct = {
                index,
                sku: product.SKU,
                productName: "---",
                amount: "---",
              }
              tempProducts.push(errorProduct)

              if (error.response && error.response.status == 404) {
                console.log(`${index} -- ${product.SKU} not found ***`)
              } else if (error.response && error.response.status == 401) {
                console.log(
                  `${index} -- ${product.SKU} authentication error ***`
                )
              } else if (error.isAxiosError) {
                console.log(
                  "Error: Client network socket disconnected before secure TLS connection was established"
                )
              } else {
                console.log(error)
              }
            })
        })
      ).catch((error) => console.log(error))
      // create output
      let wb = xlsx.utils.book_new()
      let ws = xlsx.utils.json_to_sheet(tempProducts)
      let ws_name = "Sheet1"
      let date = new Date()
      date.setHours(date.getHours() + 6)
      let localDate = date.toISOString().slice(0, 19).replaceAll(":", "-")
      let fileName = "output-" + localDate + ".xlsx"
      xlsx.utils.book_append_sheet(wb, ws, ws_name)
      xlsx.writeFile(wb, fileName)
    })()
  })
  .catch((error) => console.log(error))
