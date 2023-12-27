function getBoxVolume(rawGameItem) {
  const boxSizesDict = {};

  if (rawGameItem.versions?.item?.length > 1) {
    rawGameItem.versions.item.forEach((v) => {
      const depth = v.depth?.value;
      const length = v.length?.value;
      const width = v.width?.value;

      if (!(depth && length && width)) return;

      const sizeKey = `${depth};${length};${width}`;

      if (!boxSizesDict[sizeKey]) {
        boxSizesDict[sizeKey] = {
          count: 1,
          latestYearPublished: v.yearpublished,
          depth,
          length,
          width,
        };
      }

      boxSizesDict[sizeKey].count = boxSizesDict[sizeKey].count + 1;

      if (v.yearpublished > boxSizesDict[sizeKey].yearpublished) {
        boxSizesDict[sizeKey].latestYearPublished = v.yearpublished;
      }
    });

    const dominantVersion = Object.values(boxSizesDict).sort(
      (a, b) => b.count - a.count
    )[0];

    if (!dominantVersion) return null;

    return (
      dominantVersion.depth * dominantVersion.length * dominantVersion.width
    );
  }
}

function getNames(rawGameItem) {
  const alternativeNames = [];
  let primaryName = "";

  if (!Array.isArray(rawGameItem.name)) {
    primaryName = rawGameItem.name.value;
  } else {
    rawGameItem.name.forEach((name) => {
      if (name.type === "primary") {
        primaryName = name.value;
      } else {
        alternativeNames.push(name.value);
      }
    });
  }

  return { name: primaryName, alternativeNames };
}

const parseGameItem = (gameItem) => {
  const { description, id, image, thumbnail, type } = gameItem;

  const parsedGameItem = {
    description,
    id,
    image,
    thumbnail,
    type,
    boxVolume: getBoxVolume(gameItem),
    ...getNames(gameItem),
  };

  // Extract poll results and data
  gameItem.poll.forEach((poll) => {
    if (poll.name === "suggested_numplayers") {
      // Save polldata
      parsedGameItem.suggested_numplayers_polldata = poll;

      // Get best and recommended player counts
      parsedGameItem.suggested_numplayers_best = [];
      parsedGameItem.suggested_numplayers_recommended = [];
      parsedGameItem.suggested_numplayers_not_recommended = [];

      poll.results.forEach((option) => {
        const winningChoice = option.result.sort(
          (a, b) => b.numvotes - a.numvotes
        )[0];
        if (winningChoice.numvotes === 0) return;

        switch (winningChoice.value) {
          case "Best":
            parsedGameItem.suggested_numplayers_best.push(option.numplayers);
            break;
          case "Recommended":
            parsedGameItem.suggested_numplayers_recommended.push(
              option.numplayers
            );
            break;
          case "Not Recommended":
            parsedGameItem.suggested_numplayers_not_recommended.push(
              option.numplayers
            );
            break;
          default:
            break;
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

  return { ...parsedGameItem };
};

module.exports = { parseGameItem };
