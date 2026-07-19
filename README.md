# 📱 개인 디지털 아카이브 (통합 도서 검색)

브라우저 환경에서 직접 SQLite 데이터베이스 파일을 로드하여 동작하는 모던하고 모바일 친화적인 **개인 디지털 아카이브 및 도서 검색 웹 어플리케이션**입니다. 별도의 백엔드 데이터베이스 서버 없이, 클라이언트 사이드에서 SQL 엔진(`sql.js`)을 활용해 완벽히 프라이빗하고 빠르게 데이터를 조회할 수 있습니다.

---

## 🚀 주요 특징

- **클라이언트 사이드 SQLite 실행**: `sql.js` WebAssembly(WASM) 버전을 사용하여 브라우저 메모리상에서 `.db` 또는 `.sqlite` 파일을 직접 분석하고 조회합니다. 데이터가 외부 서버로 전송되지 않아 완벽한 프라이버시가 보장됩니다.
- **모던 모바일 친화적 UI**: Tailwind CSS v4 기반으로 깔끔하고 반응성이 뛰어난 카드 레이아웃을 제공합니다.
- **실시간 통합 검색**: 입력창에 키워드를 입력하는 즉시 도서 제목, 저자, 한국십진분류법(KDC) 코드 및 도서 속성을 기준으로 실시간 필터링이 수행됩니다.
- **상태 관리 및 표시**: 
  - 각 도서가 보관된 스토리지 정보(iPad, 외장 HDD, Google Drive)를 감지하여 시각적인 뱃지로 출력합니다.
  - 데이터베이스의 로드 상태를 상단 헤더의 뱃지(`DB 미연결` 🔴 / `SQLite Active` 🟢)를 통해 한눈에 파악할 수 있습니다.

---

## 🛠 사용 기술

- **Frontend**: HTML5, Vanilla JavaScript (ES6+)
- **CSS Framework**: Tailwind CSS v4 (CDN을 통한 JIT 컴파일)
- **Database Engine**: [sql.js v1.8.0](https://github.com/sql-js/sql.js/) (WASM 기반 인브라우저 SQLite 엔진)

---

## 📂 파일 구조

```bash
hello-world-web/
├── app.js            # 데이터베이스 로딩 및 검색 인터랙션 로직
├── index.html        # 메인 웹 어플리케이션 마크업 및 스타일 구성
├── sqlite.db         # 개인용 db 구성 파일
├── .env.example      # your_tabel_name
└── README.md         # 프로젝트 안내서
```

---

## 💻 사용 방법

### 1. 로컬 개발 서버 실행
`sql.js`의 WASM 엔진 및 관련 라이브러리 로드 시 브라우저 보안 정책(CORS)으로 인해 로컬 파일 시스템(`file://`)에서 직접 여는 것보다는 로컬 웹 서버를 이용해 구동하는 것을 권장합니다.

Node.js 환경이 설정되어 있다면, 아래와 같이 아주 가벼운 패키지를 사용하여 로컬 서버를 구동할 수 있습니다.

#### 옵션 A: `npx` 사용 (설치 불필요)
```bash
npx http-server .
# 또는
npx live-server
```

#### 옵션 B: Node.js 내장 모듈 사용 (가장 간단)
```bash
node -e "require('http').createServer((req, res) => { const fs = require('fs'); const path = req.url === '/' ? 'index.html' : '.' + req.url; fs.readFile(path, (err, data) => { if (err) { res.writeHead(404); res.end('Not Found'); } else { res.writeHead(200); res.end(data); } }); }).listen(3000, () => console.log('Server running at http://localhost:3000'));"
```

서버가 켜지면 브라우저에서 `http://localhost:8080` (또는 지정된 포트)로 접속합니다.

### 2. SQLite 데이터베이스 로드
1. 화면 상단의 **"📂 SQLite DB 파일 로드"** 영역에서 본인의 아카이브 데이터베이스 파일(`.db` 또는 `.sqlite`)을 선택합니다.
2. 로드가 완료되면 상단 우측의 뱃지가 **`SQLite Active` 🟢**로 변경됩니다.
3. 검색창에 검색어를 입력하면 하단에 실시간으로 데이터 카드가 생성됩니다.

---

## 📊 데이터베이스 스키마 요구사항

검색 및 화면 표시가 정상적으로 동작하려면 로드하는 SQLite 파일에 아래 사양의 테이블이 존재해야 합니다.

- **테이블명**: `ebook_tbl`
- **필수 컬럼**:
  - `book_id` (INTEGER, 기본키)
  - `code` (TEXT, 분류 코드)
  - `contents` (TEXT, 제목 및 내용)
  - `date` (TEXT, 등록일자)
  - `store1` (TEXT, 'O' 또는 'X' - 보관 여부)
  - `store2` (TEXT, 'O' 또는 'X' - 보관 여부)
  - `store3` (TEXT, store 식별자 또는 주소)
  - `attr` (TEXT, 파일의 포맷 혹은 속성)
