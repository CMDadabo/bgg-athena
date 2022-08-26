const axios = require("axios");
const cheerio = require("cheerio");
const xml2json = require("xml2json");

module.exports = {
  async getTopGames(numGames = 100) {
    let remainingGames = numGames;
    let currentPage = 1;
    const rankPageRequests = [];

    while (remainingGames > 0) {
      rankPageRequests.push(
        axios.get(
          `https://boardgamegeek.com/browse/boardgame/page/${currentPage}`
        )
      );
      currentPage++;
      remainingGames -= 100;
    }

    const boardgameIds = [];
    await Promise.all(rankPageRequests).then((res) => {
      res.forEach(({ data }) => {
        $ = cheerio.load(data);
        $("#collectionitems .collection_objectname a").each((idx, el) => {
          const boardgameId = el.attribs.href.split("/")[2];
          boardgameIds.push(boardgameId);
        });
      });
    });

    return boardgameIds.slice(0, numGames);
  },

  async getGamesByIds(boardgameIds) {
    const res = await axios.get(
      `https://www.boardgamegeek.com/xmlapi2/thing?type=boardgame&stats=1&id=${boardgameIds.join(
        ","
      )}`
    );
    return xml2json.toJson(res.data, { object: true, coerce: true }).items.item;
  },
};
