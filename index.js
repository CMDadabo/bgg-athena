// Scraper
// const axios = require("axios").default;
// const xml2json = require("xml2json");
const { getGamesByIds, getTopGameIds } = require("./bggClient");
const { parseGameItem } = require("./gameParser");
const { connectClient } = require("./mongoClient");
const cliProgress = require("cli-progress");
// const { size } = require("lodash");

async function main() {
  async function getRankedGames(start = 1, numGames = 1000) {
    const topGames = await getTopGameIds(start, numGames);

    const progressBar = new cliProgress.SingleBar();

    console.log("Fetching game data...");

    progressBar.start(topGames.length, 0);

    while (topGames.length > 0) {
      const games = await getGamesByIds(topGames.splice(0, 10));

      await Promise.all(
        games.map((game) => dbClient.upsertGame(parseGameItem(game)))
      );

      progressBar.increment(10);
      progressBar.updateETA();
    }

    progressBar.stop();
  }

  const dbClient = await connectClient();

  // const gamesWithSimilarGames = await dbClient.findAllSimilarGames();

  // const gameNetwork = await dbClient.getSimilarGameNetwork();

  // const links = [];
  // const nodes = [];

  // const visitedSources = {};

  // gameNetwork.forEach((game) => {
  //   nodes.push({
  //     id: game.id,
  //     name: game.name,
  //     rating: game.ratings_bayesaverage,
  //     year: game.yearpublished,
  //   });

  //   if (!game.similar_games) return;

  //   game.similar_games.slice(0, 2).forEach(({ id, similarity }) => {
  //     if (!visitedSources[`${id}-${game.id}`] && similarity > 40) {
  //       links.push({
  //         source: game.id,
  //         target: id,
  //         value: similarity,
  //       });
  //       visitedSources[`${game.id}-${id}`] = true;
  //     }
  //   });
  // });

  const games = await getRankedGames(1000, 1000);

  dbClient.close();
}

main();
