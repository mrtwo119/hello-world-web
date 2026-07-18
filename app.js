/**
 * 개인 디지털 아카이브 - KDC_ebook_v1o3 테이블 전용 검색 로직
 */

let db = null;
let SQL = null;

// 1. 페이지 로드 시 SQL.js 웹어셈블리(WASM) 엔진 초기화
async function initSqlEngine() {
    try {
        const config = {
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        SQL = await initSqlJs(config);
    } catch (error) {
        console.error("SQL 엔진 초기화 실패:", error);
    }
}

// 2. 스마트폰 파일 탐색기로부터 DB 파일을 읽어와 메모리에 주입하는 루틴
document.getElementById('dbFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function() {
        try {
            const uints = new Uint8Array(reader.result);
            db = new SQL.Database(uints);

            // UI 상태 변경 및 검색창 활성화
            updateUIConnected();

            // 최초 로드 시 전체 데이터(913행) 출력
            searchBooks('');
        } catch (error) {
            alert("올바른 SQLite DB 파일 형식이 아닙니다.\n에러 내용: " + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
});

// 3. UI 연결 상태 업데이트 함수
function updateUIConnected() {
    const statusBadge = document.getElementById('dbStatus');
    statusBadge.innerText = "SQLite Active";
    statusBadge.className = "text-xs bg-emerald-500 px-2 py-1 rounded-sm text-white font-medium";
    
    const searchInput = document.getElementById('searchInput');
    searchInput.disabled = false;
    searchInput.placeholder = "제목, 저자, ISBN 또는 파일명 키워드 검색...";
    searchInput.focus();
}

// 4. 실제 KDC_ebook_v1o3 테이블 질의 및 모바일 카드 레이아웃 렌더링
function searchBooks(keyword) {
    if (!db) return;
    
    const bookListDiv = document.getElementById('bookList');
    bookListDiv.innerHTML = '';

    // 실제 컬럼명(BookContents, KDCCode, Attribute)을 반영한 검색 쿼리
    const query = `
        SELECT * FROM KDC_ebook_v1o3 
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
            
            // 스토리지 조건 검사 ('O'일 때 활성화 스타일 적용, GDRV는 값이 매칭될 때 활성화)
            const isIpadActive = row.iPAD === 'O';
            const isExtHddActive = row.ExtHDD === 'O';
            const isGdrvActive = row.GDRV && row.GDRV !== 'NULL' && row.GDRV !== '';

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-2.5";
            
            // 모바일 캡처 UI와 데이터를 1:1 완벽 매핑
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
                ⚠️ 쿼리 처리 실패<br>
                <span class="text-xs text-gray-400">데이터베이스 스키마와 일치하지 않습니다.</span>
            </div>`;
    }
}

// 5. 실시간 검색 핸들러 등록
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchBooks(e.target.value.trim());
});

initSqlEngine();