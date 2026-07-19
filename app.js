const APP_VERSION = "v1.0.7"; // 앱 버전 정보

let db = null;
let SQL = null;
let tableName = null;

// 웹 환경 설정을 동적으로 로드하는 함수 (캐시 방지 적용)
async function loadConfig() {
    try {
        // 로컬 file:// 프로토콜 차단 여부 검사
        if (window.location.protocol === 'file:') {
            throw new Error("로컬 파일(file://) 형식으로 실행 중입니다. Live Server 등 웹 서버 환경에서 실행해야 fetch가 작동합니다.");
        }

        const response = await fetch('config_web.json?v=' + new Date().getTime(), {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`서버에서 config_web.json 파일을 찾을 수 없거나 불러오지 못했습니다. (HTTP 상태코드: ${response.status})`);
        }

        // JSON을 바로 파싱하지 않고 텍스트로 먼저 받아서 파싱 에러 추적
        const rawText = await response.text();
        
        let config;
        try {
            config = JSON.parse(rawText);
        } catch (jsonErr) {
            throw new Error(`config_web.json의 파일 내용이 올바른 JSON 형식이 아닙니다. 눈에 보이지 않는 오타나 BOM 문자가 있을 수 있습니다.\n[실제 파일 내용]: ${rawText.substring(0, 100)}`);
        }

        if (config && config.DB_TABLE_EBOOK) {
            tableName = config.DB_TABLE_EBOOK;
            console.log(`[Config] 설정 적용 완료: 테이블명 = ${tableName}`);
            return;
        }
        
        throw new Error("JSON 파싱은 성공했으나, 내부에 'DB_TABLE_EBOOK' 키 이름이 존재하지 않습니다.");

    } catch (error) {
        // 🚨 실질적인 실패 원인을 콘솔과 얼럿창에 상세히 뿌려줍니다.
        console.error("🛑 실질적 원인 리포트:", error);
        alert(`[설정 파일 로드 실패]\n\n실질적 원인:\n${error.message}\n\n앱 구동을 종료합니다.`);
    }
}

function displayVersion() {
    const versionEl = document.getElementById('appVersion');
    if (versionEl) {
        versionEl.innerText = APP_VERSION;
    }
}

// SQL 엔진 및 환경 설정을 초기화하는 함수
async function initSqlEngine() {
    displayVersion();
    
    // 로딩이 완료될 때까지 DB 파일 입력을 임시로 비활성화하여 에러를 원천 차단합니다.
    const fileInput = document.getElementById('dbFileInput');
    if (fileInput) {
        fileInput.disabled = true;
        fileInput.placeholder = "환경 설정 로딩 중...";
    }
    
    await loadConfig(); // config_web.json 로드 대기
    
    try {
        const config = {
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        SQL = await initSqlJs(config);
        
        // 초기화 완료 시 파일 입력 활성화
        if (fileInput) {
            fileInput.disabled = false;
        }
        console.log("[SQL] 엔진 및 테이블 설정 완료. 파일 입력이 활성화되었습니다.");
    } catch (error) {
        console.error("SQL 엔진 초기화 실패:", error);
    }
}

document.getElementById('dbFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 🔴 [수정] 아직 환경설정(tableName)이나 SQL 엔진이 로드되지 않았다면 실행 차단
    if (!tableName || !SQL) {
        alert("환경 설정(config_web.json)을 로딩 중입니다. 잠시 후 다시 시도해주세요.");
        e.target.value = ''; // 선택한 파일 초기화
        return;
    }

    const reader = new FileReader();
    reader.onload = function() {
        try {
            const uints = new Uint8Array(reader.result);
            db = new SQL.Database(uints);
            updateUIConnected();
            searchBooks(''); // 초기 로드 시 전체 출력
        } catch (error) {
            alert("올바른 SQLite DB 파일 형식이 아닙니다.\n에러 내용: " + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
});

function updateUIConnected() {
    const statusBadge = document.getElementById('dbStatus');
    statusBadge.innerText = "SQLite Active";
    statusBadge.className = "text-xs bg-emerald-500 px-2 py-1 rounded-sm text-white font-medium";
    
    const searchInput = document.getElementById('searchInput');
    searchInput.disabled = false;
    searchInput.placeholder = "제목, 저자, ISBN 또는 파일명 키워드 검색...";
    searchInput.focus();
}

function searchBooks(keyword) {
    if (!db) return;

    // 🔴 [수정] tableName이 없을 경우 쿼리를 수행하지 않고 중단
    if (!tableName) {
        console.warn("[Search] 테이블명이 아직 로드되지 않아 검색을 취소합니다.");
        return;
    }    
    
    const bookListDiv = document.getElementById('bookList');
    bookListDiv.innerHTML = '';

// 🔴 [수정] 테이블명에 특수문자나 숫자가 포함될 수 있으므로 백틱(`)이나 쌍따옴표(")로 감싸줍니다.
    const query = `
        SELECT * FROM "${tableName}" 
        WHERE BookContents LIKE ? OR KDCCode LIKE ? OR Attribute LIKE ?
        ORDER BY BookID ASC
    `;
    
    try {
        const stmt = db.prepare(query);
        const searchPattern = `%${keyword}%`;
        stmt.bind([searchPattern, searchPattern, searchPattern]);

        let count = 0;

        while (stmt.step()) {
            count++;
            const row = stmt.getAsObject();
            
            const isIpadActive = row.iPAD === 'O';
            const isExtHddActive = row.ExtHDD === 'O';
            const isGdrvActive = row.GDRV && row.GDRV !== 'NULL' && row.GDRV !== '';

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-2.5";
            
            card.innerHTML = `
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-400 font-mono">ID: ${row.BookID}</span>
                    <span class="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-sm">${row.KDCCode || '미분류'}</span>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-gray-900 leading-snug">${row.BookContents || '제목 없음'}</h3>
                    <p class="text-[11px] text-gray-400 mt-1">등록일자: ${row.Date && row.Date !== 'NULL' ? row.Date : '-'}</p>
                </div>
                <hr class="border-gray-100">
                <div class="flex flex-col gap-1.5 text-xs text-gray-600">
                    <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-gray-400 text-[11px] mr-1">스토리지:</span>
                        <span class="${isIpadActive ? 'bg-blue-50 text-blue-600 font-medium' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">
                            iPad: ${isIpadActive ? 'O' : 'X'}
                        </span>
                        <span class="${isExtHddActive ? 'bg-purple-50 text-purple-600 font-medium' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">
                            외장: ${isExtHddActive ? 'O' : 'X'}
                        </span>
                        <span class="${isGdrvActive ? 'bg-amber-50 text-amber-600 font-medium' : 'bg-gray-100 text-gray-400'} px-1.5 py-0.5 rounded text-[11px]">
                            구글드라이브${isGdrvActive ? ` (${row.GDRV})` : ''}
                        </span>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            🟢 해결 완료 (${row.Attribute || '파일'})
                        </span>
                        <div class="flex gap-1">
                            <button class="px-2.5 py-1 bg-gray-50 text-gray-700 font-medium rounded-md text-[11px] border border-gray-200 active:bg-gray-200">머지</button>
                            <button class="px-2.5 py-1 bg-red-50 text-red-500 font-medium rounded-md text-[11px] border border-red-100 active:bg-red-100">삭제</button>
                        </div>
                    </div>
                </div>
            `;
            bookListDiv.appendChild(card);
        }
        
        stmt.free();
        document.getElementById('resultCount').innerText = count;
        
        if (count === 0) {
            bookListDiv.innerHTML = `<div class="text-center py-12 text-gray-400 text-sm">일치하는 아카이브 파일이 없습니다.</div>`;
        }
    } catch (err) {
        console.error(err);
        bookListDiv.innerHTML = `
            <div class="text-center py-12 text-red-500 text-sm">
                ⚠️ 쿼리 처리 실패 (테이블명: ${tableName})<br>
                <span class="text-xs text-red-400 font-mono d-block mt-1">${err.message}</span><br>
                <span class="text-xs text-gray-400">데이터베이스 파일과 테이블명을 다시 확인하세요.</span>
            </div>`;
    }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    searchBooks(e.target.value.trim());
});

initSqlEngine();