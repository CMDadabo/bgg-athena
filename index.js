// Scraper
const axios = require("axios").default;
const xml2json = require("xml2json");

const getGameInfoById = (gameId) =>
  axios
    .get(
      `https://api.geekdo.com/xmlapi2/thing?id=${gameId}&thingtype=boardgame&versions=0&videos=0&stats=1&marketplace=0&comments=0&ratingcomments=0&page=1&pagesize=25`
    )
    .then((res) => {
      const parsed = parseGameItem(
        xml2json.toJson(res.data, { object: true }).items.item
      );

      return parsed;
    });

const parseGameItem = (gameItem) => {
  const { description, id, image, thumbnail, type } = gameItem;

  const parsedGameItem = { description, id, image, thumbnail, type };

  // Extract name and alternativeNames
  parsedGameItem.alternativeNames = [];
  gameItem.name.forEach((name) => {
    if (name.type === "primary") {
      parsedGameItem.name = name.value;
    } else {
      parsedGameItem.alternativeNames.push(name.value);
    }
  });

  // Extract poll results and data
  gameItem.poll.forEach((poll) => {
    if (poll.name === "suggested_numplayers") {
      parsedGameItem.suggested_numplayers_polldata = poll;
      parsedGameItem.suggested_numplayers_best = poll.results.sort(
        (a, b) =>
          b.result.find((r) => r.value === "Best").numVotes -
          a.result.find((r) => r.value === "Best").numVotes
      )[0].numplayers;
    }
  });

  // Parse links by type
  gameItem.link.forEach((link) => {
    if (!parsedGameItem[link.type]) {
      parsedGameItem[link.type] = [];
    }

    parsedGameItem[link.type].push({ value: link.value, id: link.id });
  });

  Object.entries(gameItem).forEach(([key, value]) => {
    if (
      typeof value === "object" &&
      Object.keys(value).length === 1 &&
      Object.keys(value)[0] === "value"
    ) {
      parsedGameItem[key] = value.value;
    }
  });

  console.log(parsedGameItem);

  return parsedGameItem;
};

getGameInfoById(174430);
