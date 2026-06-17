import fs from 'fs';
import path from 'path';

function bump() {
  const typesPath = path.resolve('src/types.ts');
  const pkgPath = path.resolve('package.json');

  // 1. Read CURRENT_VERSION from src/types.ts
  let typesContent = '';
  let currentTypesVersion = '1.0.0';
  if (fs.existsSync(typesPath)) {
    typesContent = fs.readFileSync(typesPath, 'utf8');
    const match = typesContent.match(/export\s+const\s+CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      currentTypesVersion = match[1];
    }
  }

  // 2. Read version from package.json
  let pkg = { version: '1.0.0' };
  let currentPkgVersion = '1.0.0';
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    currentPkgVersion = pkg.version || '1.0.0';
  }

  // Compare both versions and select the highest as the baseline
  const parseVersion = (v) => {
    const parts = v.replace(/[^0-9.]/g, '').split('.').map(Number);
    while (parts.length < 3) parts.push(0);
    return parts;
  };

  const vTypes = parseVersion(currentTypesVersion);
  const vPkg = parseVersion(currentPkgVersion);

  let baseVersion = vTypes;
  let usePkg = false;
  for (let i = 0; i < 3; i++) {
    if (vPkg[i] > vTypes[i]) {
      usePkg = true;
      break;
    } else if (vPkg[i] < vTypes[i]) {
      break;
    }
  }

  if (usePkg) {
    baseVersion = vPkg;
  }

  // Increment patch number (last part)
  baseVersion[2] += 1;
  const newVerString = baseVersion.join('.');

  console.log(`Current: types.ts=${currentTypesVersion}, package.json=${currentPkgVersion}`);
  console.log(`Incrementing to: ${newVerString}`);

  // 3. Update package.json
  pkg.version = newVerString;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 4. Update src/types.ts
  if (typesContent) {
    const updatedTypesContent = typesContent.replace(
      /(export\s+const\s+CURRENT_VERSION\s*=\s*)(['"])[^'"]+(['"])/,
      `$1$2${newVerString}$3`
    );
    fs.writeFileSync(typesPath, updatedTypesContent, 'utf8');
  }

  console.log('Successfully synchronized and bumped versions!');
}

bump();
