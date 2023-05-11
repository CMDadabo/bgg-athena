// Scraper
const axios = require("axios").default;
const xml2json = require("xml2json");
const _ = require("lodash");
const { getTopGames, getGamesByIds } = require("./bggClient");
const { connectClient } = require("./mongoClient");
const { size } = require("lodash");

const parseGameItem = (gameItem) => {
  const { description, id, image, thumbnail, type } = gameItem;

  const parsedGameItem = { description, id, image, thumbnail, type };

  const boxSizesDict = {};

  const versions = gameItem.versions.item.forEach((v) => {
    const depth = v.depth?.value;
    const length = v.length?.value;
    const width = v.width?.value;

    if (!(depth && length && width)) return;

    const sizeKey = `${depth};${length};${width}`;

    if (!boxSizesDict[sizeKey]) {
      boxSizesDict[sizeKey] = {
        count: 1,
        latestYearPublished: v.yearpublished,
      };
    }

    boxSizesDict[sizeKey].count = boxSizesDict[sizeKey].count + 1;

    if (v.yearpublished > boxSizesDict[sizeKey].yearpublished) {
      boxSizesDict[sizeKey].latestYearPublished = v.yearpublished;
    }
  });

  // Extract name and alternativeNames
  parsedGameItem.alternativeNames = [];

  if (!_.isArray(gameItem.name)) {
    parsedGameItem.name = gameItem.name.value;
  } else {
    gameItem.name.forEach((name) => {
      if (name.type === "primary") {
        parsedGameItem.name = name.value;
      } else {
        parsedGameItem.alternativeNames.push(name.value);
      }
    });
  }

  // Extract poll results and data
  gameItem.poll.forEach((poll) => {
    if (poll.name === "suggested_numplayers") {
      // Save polldata
      parsedGameItem.suggested_numplayers_polldata = poll;

      // Get best and recommended player counts
      parsedGameItem.suggested_numplayers_best = null;
      parsedGameItem.suggested_numplayers_recommended = [];
      let bestPlayerCountVotes = 0;

      poll.results.forEach((option) => {
        const voteData = {};
        option.result.forEach(
          ({ value, numvotes }) => (voteData[value] = numvotes)
        );

        if (voteData["Best"] > bestPlayerCountVotes) {
          bestPlayerCountVotes = voteData["Best"];
          parsedGameItem.suggested_numplayers_best = option.numplayers;
        }

        if (
          voteData["Recommended"] + voteData["Best"] >
          voteData["Not Recommended"]
        ) {
          parsedGameItem.suggested_numplayers_recommended.push(
            option.numplayers
          );
        }
      });
    } else {
      const valueKey = poll.name === "language_dependence" ? "level" : "value";

      let modeValue, medianValue;
      let modeVotes = 0,
        totalValue = 0;
      let remainingVotes = poll.totalvotes;

      poll.results.result.forEach((option) => {
        if (option.numvotes > modeVotes) {
          modeVotes = option.numvotes;
          modeValue = option[valueKey];
        }

        totalValue +=
          (option[valueKey] === "21 and up" ? 21 : option[valueKey]) *
          option.numvotes;

        if (!medianValue) {
          remainingVotes -= option.numvotes;

          if (remainingVotes < poll.totalvotes / 2) {
            medianValue = option[valueKey];
          }
        }
      });

      parsedGameItem[`${poll.name}_mean`] = parseFloat(
        (totalValue / poll.totalvotes).toFixed(2)
      );
      parsedGameItem[`${poll.name}_median`] = medianValue;
      parsedGameItem[`${poll.name}_mode`] = modeValue;
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

  // Extract ratings
  Object.entries(gameItem.statistics.ratings).forEach(([key, value]) => {
    if (
      typeof value === "object" &&
      Object.keys(value).length === 1 &&
      Object.keys(value)[0] === "value"
    ) {
      parsedGameItem[`ratings_${key}`] = value.value;
    }
  });

  return parsedGameItem;
};

async function main() {
  async function getFirstXGames(num = 1000) {
    const topGames = await getTopGames(num);

    const games = await getGamesByIds(topGames);

    return await Promise.all(
      games.map((game) => dbClient.upsertGame(parseGameItem(game)))
    );
  }

  const dbClient = await connectClient();

  // const gamesWithSimilarGames = await dbClient.findAllSimilarGames();

  const gameNetwork = await dbClient.getSimilarGameNetwork();

  const links = [];
  const nodes = [];

  const visitedSources = {};

  gameNetwork.forEach((game) => {
    nodes.push({
      id: game.id,
      name: game.name,
      rating: game.ratings_bayesaverage,
      year: game.yearpublished,
    });

    if (!game.similar_games) return;

    game.similar_games.slice(0, 2).forEach(({ id, similarity }) => {
      if (!visitedSources[`${id}-${game.id}`] && similarity > 40) {
        links.push({
          source: game.id,
          target: id,
          value: similarity,
        });
        visitedSources[`${game.id}-${id}`] = true;
      }
    });
  });

  const games = await getFirstXGames(2);

  dbClient.close();
}

main();
