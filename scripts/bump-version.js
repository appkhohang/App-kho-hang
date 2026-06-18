import fs from 'fs';
import path from 'path';

function bump() {
  const typesPath = path.resolve('src/types.ts');
  const pkgPath = path.resolve('package.json');
  const publicVPath = path.resolve('public/version.json');

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

  // 3. Read version from public/version.json
  let pubV = { version: '1.0.0' };
  let currentPubVersion = '1.0.0';
  if (fs.existsSync(publicVPath)) {
    pubV = JSON.parse(fs.readFileSync(publicVPath, 'utf8'));
    currentPubVersion = pubV.version || '1.0.0';
  }

  // Compare versions and select the highest as the baseline
  const parseVersion = (v) => {
    const parts = v.replace(/[^0-9.]/g, '').split('.').map(Number);
    while (parts.length < 3) parts.push(0);
    return parts;
  };

  const vTypes = parseVersion(currentTypesVersion);
  const vPkg = parseVersion(currentPkgVersion);
  const vPub = parseVersion(currentPubVersion);

  // Compare and find max
  let compareAndMax = (v1, v2) => {
    for (let i = 0; i < 3; i++) {
      if (v1[i] > v2[i]) return v1;
      if (v1[i] < v2[i]) return v2;
    }
    return v1;
  };

  let baseVersion = compareAndMax(vTypes, vPkg);
  baseVersion = compareAndMax(baseVersion, vPub);

  // Increment patch number (last part)
  baseVersion[2] += 1;
  const newVerString = baseVersion.join('.');

  console.log(`Current: types.ts=${currentTypesVersion}, package.json=${currentPkgVersion}, version.json=${currentPubVersion}`);
  console.log(`Incrementing to: ${newVerString}`);

  // Update package.json
  pkg.version = newVerString;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // Update src/types.ts
  if (typesContent) {
    const updatedTypesContent = typesContent.replace(
      /(export\s+const\s+CURRENT_VERSION\s*=\s*)(['"])[^'"]+(['"])/,
      `$1$2${newVerString}$3`
    );
    fs.writeFileSync(typesPath, updatedTypesContent, 'utf8');
  }

  // Update public/version.json
  if (fs.existsSync(publicVPath)) {
    pubV.version = newVerString;
    // Format releaseDate as DD/MM/YYYY
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    pubV.releaseDate = `${day}/${month}/${year}`;
    
    fs.writeFileSync(publicVPath, JSON.stringify(pubV, null, 2) + '\n', 'utf8');
  }

  console.log('Successfully synchronized and bumped versions of package.json, src/types.ts, and public/version.json!');
}

bump();
