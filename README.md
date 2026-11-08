# Uncommon Glyphs

글자 실루엣 안을 무작위 유기 형태(세포 링·덩어리, 가지·잎·덩굴, 디지털 글리치)로 채우는 p5.js 생성 드로잉.

## 조작
- 마우스 이동: 변형 (첫 글자는 X축, 둘째 글자는 Y축, 12가지 버전)
- 클릭: 새 무작위 시드로 다시 생성
- 글자 입력: 텍스트 변경 (최대 8자) · Backspace: 지우기
- Enter: 현재 화면 PNG 저장

## 로컬 실행
```bash
python3 -m http.server 8769
```
http://localhost:8769 접속.

## 배포
빌드 과정 없는 정적 사이트입니다. 저장소 루트를 그대로 GitHub Pages(Settings → Pages → Deploy from branch → `main` / root), Vercel, Netlify 어디에 올려도 됩니다.

## 구성
- `index.html` — 페이지
- `style.css` — 스타일
- `sketch.js` — p5.js 스케치 (p5 1.9.4 CDN, 폰트 Archivo Black / Google Fonts)
