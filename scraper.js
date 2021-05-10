const axios = require('axios');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const fs = require('fs');
const json2csv = require('json2csv').Parser;
const path = require('path');

let imageLinks = [];

const getLinks = () => {
  return axios
    .get("https://vipp.com/en/api/products?start=0&amount=133")
    .then((response) => {
      return response.data.products.map(item =>
        item.link
      )
    })
    .catch((error) => {
      console.error(error);
    });
};

const getData = async (link) => {
  return axios.get(`https://vipp.com${link}`, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Host': 'vipp.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
      'Accept-Language': 'en-us',
    }
  }).then((response) => {
    const $ = cheerio.load(response.data);
    let design = ($('.col-md-7:contains("Design")').next().children().eq(0).text().trim());
    let currency = $('.price-box').text().trim().split(' ')[0];
    let price = $('.price-box').text().trim().split(' ')[1];
    let sku = `vipp_${$('.product-info__flag h4').text().trim().split(' ')[0]}`;
    let product_name = $('.product-info__flag h1').text().trim();
    let material = ($('.col-md-7:contains("Materials")').next().children().eq(0).text().trim());
    let img = {
      sku: sku,
      imgLinks: []
    }
    let imgs = $('.wrapper-img img');
    for (let i = 0; i < imgs.length; i++) {
      img.imgLinks.push(imgs.eq(i).attr('src'));
    }
    imageLinks.push(img);

    return ({
      sku: sku,
      category: 'N/A',
      brand: 'Vipp',
      supplier: 'Vipp',
      parent_name: 'N/A',
      product_name: product_name,
      variant_name: 'N/A',
      description: $('.product-info__flag .text').text().trim(),
      price: price,
      currency: currency,
      colors: '.',
      width: 'placeholder',
      height: 'placeholder',
      depth: 'placeholder',
      weight: 'N/A',
      collection: 'N/A',
      designer: design.length ? design : 'N/A',
      awards: 'N/A',
      material: material.length? material : 'N/A',
      dimensions: 'placeholder',
    })
  }).catch((error) => {
    console.log(error.response.status);
  })
}

const downloadImages = async (img, downloadFolder) => {
  try {
    for(let index = 0; index<img.imgLinks.length; index++){
      const localFilePath = path.resolve(__dirname, downloadFolder, `${img.sku}_${index}.jpg`);
      const response = await axios({
        method: 'GET',
        url: img.imgLinks[index],
        responseType: 'stream'
      });
      response.data.pipe(fs.createWriteStream(localFilePath));
    }

  } catch (error) {
    console.log(error);
  }
}

(async function runScraper() {
  const j2cp = new json2csv();
  const links = await getLinks()
  await Promise.map(links, async (link) => {
    return getData(link);
  }, { concurrency: 30 }).then(data => {
    //console.log(data);
    const csv = j2cp.parse(data);
    fs.writeFileSync('./data.csv', csv, 'utf-8')
  });
  await Promise.map(imageLinks, async (img) => {
    downloadImages(img, 'images');
  })
})()
