const { MongoClient } = require("mongodb");
const _ = require("lodash");

// Connection URL
const url = "mongodb://localhost:27017";
const client = new MongoClient(url);

// Database Name
const dbName = "bgg-athena-mirror";

async function connectClient() {
  // Use connect method to connect to the server
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db(dbName);
  const games = db.collection("games");

  return {
    async upsertGame(game) {
      return games.updateOne(
        { id: game.id },
        { $set: game, $unset: { similarGames: "" } },
        { upsert: true }
      );
    },
    async findSimilarGames(game, otherGames) {
      const similarGames = [];

      otherGames.forEach((compareGame) => {
        const criteria = {
          boardgamecategory: 25,
          boardgamemechanic: 25,
          boardgamedesigner: 20,
          boardgamefamily: 15,
          boardgamepublisher: 10,
          boardgameartist: 5,
        };

        let similarity = 0;

        Object.entries(criteria).forEach(([attribute, weight]) => {
          if (!game[attribute] || !compareGame[attribute]) {
            return;
          }

          const intersection = _.intersectionBy(
            game[attribute],
            compareGame[attribute],
            "id"
          );

          similarity +=
            ((intersection.length * 2) /
              (game[attribute].length + compareGame[attribute].length)) *
            weight;
        });

        compareGame.similar_games.push({
          id: game.id,
          name: game.name,
          similarity,
        });

        similarGames.push({
          id: compareGame.id,
          name: compareGame.name,
          similarity,
        });
      });

      const topSimilarGames = similarGames
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

      const updated = await games.updateOne(
        { id: game.id },
        { $set: { similar_games: topSimilarGames } },
        { upsert: true }
      );

      return similarGames;
    },
    async findAllSimilarGames() {
      const allGames = [];

      const gamesCursor = await games
        .find({})
        .sort({ ratings_bayesaverage: -1 })
        .limit(1000);

      while (await gamesCursor.hasNext()) {
        const currGame = await gamesCursor.next();

        currGame.similar_games = this.findSimilarGames(currGame, allGames);

        allGames.push(currGame);
      }

      await Promise.all(
        allGames
          .map((game) => ({
            ...game,
            similar_games: game.similar_games
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 10),
          }))
          .map((game) => this.upsertGame(game))
      );
    },
    async getSimilarGameNetwork() {
      const gamesCursor = await games.find(
        {},
        {
          sort: { ratings_bayesaverage: -1 },
          projection: {
            id: 1,
            name: 1,
            yearpublished: 1,
            ratings_bayesaverage: 1,
            "similar_games.id": 1,
            "similar_games.similarity": 1,
          },
        }
      );
      return gamesCursor.toArray();
    },
    close: function () {
      client.close();
    },
  };
}

module.exports = { connectClient };
