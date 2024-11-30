const readline = require("readline");
const crypto = require("crypto");

class Dice {
  constructor(values) {
    if (values.length !== 6 || !values.every((v) => Number.isInteger(v))) {
      throw new Error("Each dice must have 6 integers.");
    }
    this.values = values;
  }

  roll() {
    const index = Math.floor(Math.random() * this.values.length);
    return this.values[index];
  }
}

class DiceParser {
  static parse(args) {
    if (args.length < 3) {
      throw new Error("You must provide at least 3 dice configurations.");
    }
    return args.map((arg) => {
      const values = arg.split(",").map(Number);
      return new Dice(values);
    });
  }
}

class ProbabilityCalculator {
  static calculateWinProbability(diceA, diceB) {
    let wins = 0;
    const total = diceA.values.length * diceB.values.length;

    for (const valA of diceA.values) {
      for (const valB of diceB.values) {
        if (valA > valB) {
          wins++;
        }
      }
    }

    return (wins / total).toFixed(2);
  }
}

class ProbabilityTable {
  static generate(diceList) {
    const rows = ["Dice \\ Dice", ...diceList.map((_, i) => `Dice ${i}`)];
    const table = [rows];

    diceList.forEach((diceA, i) => {
      const row = [`Dice ${i}`];
      diceList.forEach((diceB) => {
        const prob = ProbabilityCalculator.calculateWinProbability(
          diceA,
          diceB
        );
        row.push(prob);
      });
      table.push(row);
    });

    return table.map((row) => row.join(" | ")).join("\n");
  }
}

class FairRandomGenerator {
  constructor() {
    this.secretKey = crypto.randomBytes(32).toString("hex");
  }

  generate(range) {
    const randomNumber = crypto.randomInt(range);
    const hmac = crypto
      .createHmac("sha3-256", this.secretKey)
      .update(String(randomNumber))
      .digest("hex");
    return { randomNumber, hmac };
  }

  revealKey() {
    return this.secretKey;
  }
}

class GameEngine {
  constructor(diceList) {
    this.diceList = diceList;
    this.cli = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async play() {
    try {
      console.log("Let's determine who makes the first move.");
      const generator = new FairRandomGenerator();
      const { randomNumber, hmac } = generator.generate(2);

      console.log(`I selected a random value (HMAC=${hmac}).`);

      let userGuess;
      while (true) {
        const input = await this.ask(
          "Try to guess (0 or 1), 'X' to exit, or '?' for help: "
        );
        if (input.toLowerCase() === "x") {
          console.log("You exited the game.");
          process.exit(0);
        } else if (input === "?") {
          console.log(
            "Help: Enter 0 or 1 to make a guess. 'X' exits the game."
          );
        } else if (input === "0" || input === "1") {
          userGuess = parseInt(input);
          break;
        } else {
          console.log("Invalid input. Please try again.");
        }
      }

      const computerFirst = randomNumber !== userGuess;
      console.log(
        `My selection: ${randomNumber} (KEY=${generator.revealKey()}).`
      );
      console.log(
        `${computerFirst ? "Computer" : "User"} makes the first move.`
      );

      // **Dice Selection Phase**
      let computerDiceIndex, userDiceIndex;

      if (computerFirst) {
        computerDiceIndex = this.autoSelectDice();
        userDiceIndex = await this.selectDice("User", computerDiceIndex);
      } else {
        userDiceIndex = await this.selectDice("User");
        computerDiceIndex = this.autoSelectDice(userDiceIndex);
        console.log(`Computer selected: Dice ${computerDiceIndex}`);
      }

      const userDice = this.diceList[userDiceIndex];
      const computerDice = this.diceList[computerDiceIndex];

      console.log(`User selected: ${userDice.values.join(",")}`);
      console.log(`Computer selected: ${computerDice.values.join(",")}`);

      // **Throw Phase**
      console.log("It's time for the throws!");
      const userThrow = await this.throwDice(userDice, "User");
      const computerThrow = await this.throwDice(computerDice, "Computer");

      console.log(`User throw: ${userThrow}`);
      console.log(`Computer throw: ${computerThrow}`);

      // **Determine the Winner**
      if (userThrow > computerThrow) {
        console.log("User wins!");
      } else if (computerThrow > userThrow) {
        console.log("Computer wins!");
      } else {
        console.log("It's a tie!");
      }
    } catch (err) {
      console.error(err.message);
    } finally {
      this.cli.close();
    }
  }

  ask(question) {
    return new Promise((resolve) =>
      this.cli.question(question, (answer) => resolve(answer))
    );
  }

  async selectDice(player, excludeIndex = null) {
    console.log(`${player}, select your dice:`);

    // Display available dice
    this.diceList.forEach((dice, index) => {
      if (index !== excludeIndex) {
        console.log(`${index}: ${dice.values.join(",")}`);
      }
    });

    while (true) {
      const choice = await this.ask(
        "Enter a dice number, 'X' to exit, or '?' for help: "
      );
      if (choice.toLowerCase() === "x") {
        console.log(`${player} exited the game.`);
        process.exit(0);
      } else if (choice === "?") {
        console.log("Help: Showing probability table.");
        console.log(ProbabilityTable.generate(this.diceList));
      } else {
        const index = parseInt(choice);
        if (
          !isNaN(index) &&
          index >= 0 &&
          index < this.diceList.length &&
          index !== excludeIndex
        ) {
          return index;
        } else {
          console.log("Invalid selection. Please try again.");
        }
      }
    }
  }

  autoSelectDice(excludeIndex) {
    const choices = this.diceList
      .map((_, index) => index)
      .filter((i) => i !== excludeIndex);
    const selection = choices[Math.floor(Math.random() * choices.length)];
    console.log(`Computer selected dice ${selection}: ${this.diceList[selection].values.join(",")}`);
    return selection;
  }

  async throwDice(dice, player) {
    console.log(`${player}, prepare to roll your dice!`);

    const generator = new FairRandomGenerator();
    const { randomNumber, hmac } = generator.generate(dice.values.length);

    console.log(`Computer selected a random value (HMAC=${hmac}).`);

    while (true) {
      console.log("Add your number modulo 6:");
      dice.values.forEach((value, index) => console.log(`${index} - ${value}`));
      console.log("X - Exit\n? - Help");

      const choice = await this.ask("Enter your selection: ");
      if (choice.toLowerCase() === "x") {
        console.log(`${player} exited the game.`);
        process.exit(0);
      } else if (choice === "?") {
        console.log(
          "Help: Enter a number between 0 and 5 to select a modulo. 'X' exits the game."
        );
        console.log(
          "The modulo is applied to align your choice with a dice value."
        );
      } else {
        const userNumber = parseInt(choice);
        if (
          !isNaN(userNumber) &&
          userNumber >= 0 &&
          userNumber < dice.values.length
        ) {
          const result = (randomNumber + userNumber) % dice.values.length;
          console.log(
            `${player}'s number is ${
              dice.values[result]
            } (KEY=${generator.revealKey()}).`
          );
          return dice.values[result];
        } else {
          console.log("Invalid input. Please try again.");
        }
      }
    }
  }
}

class Validation {
  static validateArgs(args) {
    if (args.length < 3) {
      throw new Error("Invalid input: At least 3 dice are required.");
    }
    args.forEach((arg, index) => {
      const values = arg.split(",").map(Number);
      if (values.length !== 6 || values.some(isNaN)) {
        throw new Error(
          `Invalid dice at position ${
            index + 1
          }: ${arg}. Each dice must contain 6 integers.`
        );
      }
    });
  }
}

const args = process.argv.slice(2);

try {
  Validation.validateArgs(args);
  const diceList = DiceParser.parse(args);

  const game = new GameEngine(diceList);
  game.play();
} catch (err) {
  console.error(`Error: ${err.message}`);
  console.log(
    "Usage: node game.js <dice1> <dice2> <dice3> [...]\nExample: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3"
  );
}
