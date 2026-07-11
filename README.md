# Studyroom Blog

Next.js + FastAPI로 만든 개인 개발공부용 Markdown 블로그입니다.

## 실행

```bash
npm install
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## 로그인

- 아이디: `chldlsrb08`
- 비밀번호는 원문을 코드에 저장하지 않고 `backend/.env`의 PBKDF2 해시로 검증합니다.

비밀번호를 바꾸려면:

```bash
backend/.venv/bin/python backend/scripts/hash_password.py
```

출력된 값을 `backend/.env`의 `ADMIN_PASSWORD_HASH`에 넣으면 됩니다.

## 글과 이미지 저장

- 글 메타데이터: `backend/data/posts/index.json`
- 글 본문 Markdown: `backend/data/posts/{slug}.md`
- 카테고리: `backend/data/categories.json`
- 업로드 이미지: `backend/data/uploads/`

## AI 요약 연결

기본 상태에서는 API 키 없이 로컬 fallback 요약을 사용합니다. 모델을 연결하려면 `backend/.env`에 값을 채웁니다.

```env
AI_MODEL=openai:gpt-4o-mini
AI_API_KEY=your_api_key
```

글 작성 화면의 `요약 생성` 버튼이 `/api/ai/summarize`를 호출합니다.
