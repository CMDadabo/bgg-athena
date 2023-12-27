const axios = require("axios");
const cheerio = require("cheerio");
const xml2json = require("xml2json");
const cliProgress = require("cli-progress");
const { open } = require("fs/promises");

module.exports = {
  // TODO: Fetch latest CSV from BGG
  async getTopGameIds() {
    const file = await open("./data/boardgames_ranks.csv", "r");

    const topIds = [];

    for await (const line of file.readLines()) {
      const [
        id,
        name,
        yearPublished,
        rank,
        bayesAverage,
        average,
        usersRated,
        ...rest
      ] = line.split(",");

      if (rank <= 10000 && rank > 0) {
        topIds.push(id);
      }
    }

    return topIds;
  },

  async getGamesByIds(boardgameIds) {
    try {
      const res = await axios.get(
        `https://www.boardgamegeek.com/xmlapi2/thing?type=boardgame&stats=1&versions=1&id=${boardgameIds.join(
          ","
        )}`
      );
      return xml2json.toJson(res.data, { object: true, coerce: true }).items
        .item;
    } catch (err) {
      console.log(err);
    }
  },
};
