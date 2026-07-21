const { JSDOM } = require("jsdom");
const dom = new JSDOM("", { url: "http://localhost" });
const { localStorage } = dom.window;
let count = 0;
localStorage.setItem = function (...args) {
  count++;
  throw new Error("boom");
};
try {
  localStorage.setItem("a", "b");
} catch (e) {}
console.log("count", count, "stored", localStorage.getItem("a"));
console.log(Object.getOwnPropertyDescriptor(localStorage, "setItem"));
