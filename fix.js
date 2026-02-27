const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the \` issue
content = content.replace(/\\`<svg/g, '\'<svg');
content = content.replace(/<\/svg>\\`/g, '</svg>\'');
content = content.replace(/\\`\\\$\\{mins\\}:\\\$\\{secs\\}\\`/g, '`${mins}:${secs}`');
content = content.replace(/\\`\\\$\\{formatTime\\(audio\\.currentTime\\)\\} \/ \\\$\\{formatTime\\(audio\\.duration\\)\\}\\`/g, '`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`');

// Replace any \`${...} \` or missing backticks with proper `
content = content.replace(/autoBtn\.innerText = `Auto Mode: \$\{ this\.autoMode \? 'ON' : 'OFF' \} `/g, 'autoBtn.innerText = `Auto Mode: ${this.autoMode ? \'ON\' : \'OFF\'}`');
content = content.replace(/autoBtn\.innerText = Auto Mode: \$\{ this\.autoMode \? 'ON' : 'OFF' \} /g, 'autoBtn.innerText = `Auto Mode: ${this.autoMode ? \'ON\' : \'OFF\'}`');

// Fix the input - ${ key }  spaces or missing backticks
content = content.replace(/getElementById\(`input - \$\{ key \} `\)/g, 'getElementById(`input-${key}`)');
content = content.replace(/getElementById\(input - \$\{ key \} \)/g, 'getElementById(`input-${key}`)');

content = content.replace(/getElementById\(`val - \$\{ key \} `\)/g, 'getElementById(`val-${key}`)');
content = content.replace(/getElementById\(val - \$\{ key \} \)/g, 'getElementById(`val-${key}`)');

// fallback regex for weirdness
content = content.replace(/getElementById\(`input - \$\{ key \} `\)/g, 'getElementById(`input-${key}`)');
content = content.replace(/getElementById\(`val - \$\{ key \} `\)/g, 'getElementById(`val-${key}`)');

// Fix any lingering formatTime corrupted templated strings like \`\${mins}:\${secs}\`
content = content.replace(/\\`\\\$\\{mins\\}:\\\$\\{secs\\}\\`/g, '`${mins}:${secs}`');
// I will just rewrite the methods that got corrupted.
content = content.replace(/const formatTime[\s\S]*?audio\.currentTime = \(val \/ 100\) \* audio\.duration\n        }/, `const formatTime = (s: number) => {
          if (isNaN(s)) return '0:00'
          const mins = Math.floor(s / 60)
          const secs = Math.floor(s % 60).toString().padStart(2, '0')
          return \`\${mins}:\${secs}\`
        }

        audio.ontimeupdate = () => {
          if (audio.duration) {
            progress.value = ((audio.currentTime / audio.duration) * 100).toString()
            timeDisplay.innerText = \`\${formatTime(audio.currentTime)} / \${formatTime(audio.duration)}\`
          }
        }

        audio.onended = () => {
          audio.currentTime = 0
          audio.play()
        }

        progress.oninput = (e) => {
          const val = parseFloat((e.target as HTMLInputElement).value)
          audio.currentTime = (val / 100) * audio.duration
        }`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed main.ts');
