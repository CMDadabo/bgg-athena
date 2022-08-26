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
      return games.updateOne({ id: game.id }, { $set: game }, { upsert: true });
    },
    async findSimilarGames(gameId) {
      const game = await games.findOne({ id: gameId });

      const gamesCursor = await games.find(
        {},
        {
          sort: { ratings_bayesaverage: -1 },
        }
      );

      const similarGames = [];

      await gamesCursor.forEach((compareGame) => {
        if (game.id === compareGame.id) return;

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

      return topSimilarGames;
    },
    async findAllSimilarGames() {
      const gamesCursor = await games.find(
        {},
        {
          sort: { ratings_bayesaverage: -1 },
        }
      );

      const threads = [];

      await gamesCursor.forEach(async (game) =>
        threads.push(this.findSimilarGames(game.id))
      );

      await Promise.all(threads);
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
