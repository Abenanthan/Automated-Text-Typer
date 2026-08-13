// Grab the elements
const title = document.getElementById("title");
const button = document.getElementById("colorBtn");

// Array of colors to cycle through
const colors = ["#e63946", "#2a9d8f", "#f4a261", "#264653", "#6a4c93"];
let index = 0;

// Event listener for button click
button.addEventListener("click", () => {
    title.style.color = colors[index];
    index = (index + 1) % colors.length; // cycle through colors
});
