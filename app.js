const APP_VERSION = "v1.0.8"; // 앱 버전 정보

let db = null;
let SQL = null;

const DB_TABLE_EBOOK = "KDC_ebook_v1o3"; 

function displayVersion() {
    const versionEl = document.getElementById('appVersion');
    if (versionEl) {
        versionEl.innerText = APP_VERSION;
    }
}

// SQL 엔진을 초기화하는 함수
async function initSqlEngine() {
    displayVersion();
    
    const fileInput = document.getElementById('dbFileInput');
    if (fileInput) {
        fileInput.disabled = true;
        fileInput.placeholder = "SQL 엔진 로딩 중...";
    }
    
    try {
        const config = {
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        SQL = await initSqlJs(config);
        
        if (fileInput) {
            fileInput.disabled = false;
            fileInput.placeholder = "";
        }
        console.log("[SQL] 엔진 초기화 완료. 파일 입력이 활성화되었습니다.");
    } catch (error) {
        console.error("SQL 엔진 초기화 실패:", error);
    }
}

document.getElementById('dbFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!SQL) {
        alert("SQL 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
        e.target.value = '';
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
    if (statusBadge) {
        statusBadge.innerText = "SQLite Active";
        statusBadge.className = "text-xs bg-emerald-500 px-2 py-1 rounded-sm text-white font-medium";
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.disabled = false;
        searchInput.placeholder = "제목, 저자, ISBN 또는 파일명 키워드 검색...";
        searchInput.focus();
    }
}

function searchBooks(keyword) {
    if (!db) return;
    
    const bookListDiv = document.getElementById('bookList');
    if (!bookListDiv) return;
    bookListDiv.innerHTML = '';

    // 🟢 [변경] 외부 변수 대신 고정된 상수를 사용하여 안정적으로 쿼리를 조립합니다.
    const query = `
        SELECT * FROM "${DB_TABLE_EBOOK}" 
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
        
        const resultCountEl = document.getElementById('resultCount');
        if (resultCountEl) resultCountEl.innerText = count;
        
        if (count === 0) {
            bookListDiv.innerHTML = `<div class="text-center py-12 text-gray-400 text-sm">일치하는 아카이브 파일이 없습니다.</div>`;
        }
    } catch (err) {
        console.error(err);
        bookListDiv.innerHTML = `
            <div class="text-center py-12 text-red-500 text-sm">
                ⚠️ 쿼리 처리 실패 (테이블명: ${DB_TABLE_EBOOK})<br>
                <span class="text-xs text-red-400 font-mono d-block mt-1">${err.message}</span>
            </div>`;
    }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    searchBooks(e.target.value.trim());
});

initSqlEngine();