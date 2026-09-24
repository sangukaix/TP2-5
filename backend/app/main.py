"""React 대시보드용 일반 Backend 진입점입니다."""

from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.schemas import BoundaryFeatureCollection
from app.auth import router as auth_router, setting as auth_setting
from app.services.vworld import get_sido_boundaries, get_sigungu_boundaries


app = FastAPI(title='STAY-UP AI Backend', version='0.1.0')
app.include_router(auth_router)


@app.exception_handler(RequestValidationError)
async def auth_validation_error(request: Request, exc: RequestValidationError):
    if request.url.path.startswith(('/api/v1/auth/', '/api/v1/users/')):
        return JSONResponse(status_code=422, content={
            'detail': {'code': 'VALIDATION_ERROR', 'message': '입력 내용을 확인해주세요.'},
        })
    return await request_validation_exception_handler(request, exc)

app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)

# 개발 중 Vite 화면에서 직접 API를 확인할 수 있도록 허용합니다. 배포 시 실제 도메인으로 제한합니다.
local_origins = [f'http://{host}:{port}' for host in ('localhost', '127.0.0.1')
                 for port in (5173, 5175, 5176, 5177)]
app_origin = auth_setting('APP_ORIGIN').rstrip('/')
app.add_middleware(
    CORSMiddleware,
    allow_origins=(local_origins if auth_setting('APP_ENV') != 'production' else [])
                  + ([app_origin] if app_origin else []),
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PATCH', 'DELETE'],
    allow_headers=['*'],
)


@app.get('/health')
async def health_check() -> dict[str, str]:
    """서버가 실행 중인지 확인하는 가장 작은 상태 확인 API입니다."""
    return {'status': 'ok'}


@app.get('/api/v1/boundaries/sigungu', response_model=BoundaryFeatureCollection)
async def read_sigungu_boundaries(
    sido_code: str | None = Query(default=None, pattern=r'^\d{2}$'),
) -> dict[str, Any]:
    """React 지도에 필요한 전국 또는 선택 시도의 시군구 경계입니다."""
    collection = await get_sigungu_boundaries()
    if not sido_code:
        return collection
    features = [
        feature for feature in collection['features']
        if feature['properties']['region_code'].startswith(sido_code)
    ]

    # 2026-07-01 인천 행정체제 개편 전에 집계된 서구 원자료를 선택할 수 있게
    # 현재 서해구·검단구 경계를 합친 "원자료 기준" 분석 영역을 추가합니다.
    # 현재 행정통계를 합산하는 기능이 아니라, 2026년 6월까지의 기존 서구 자료 표시용입니다.
    if sido_code == '28' and not any(feature['properties']['region_code'] == '28260' for feature in features):
        former_seogu_parts = [
            feature for feature in features
            if feature['properties']['region_code'] in {'28275', '28290'}
        ]
        if len(former_seogu_parts) == 2:
            coordinates: list[Any] = []
            for feature in former_seogu_parts:
                coordinates.extend(feature['geometry']['coordinates'])
            features.append({
                'type': 'Feature',
                'properties': {
                    'region_code': '28260',
                    'region_name': '인천광역시 서구',
                    'display_name': '인천광역시 서구 (2026.06 원자료 기준)',
                },
                'geometry': {'type': 'MultiPolygon', 'coordinates': coordinates},
            })
    return {
        'type': 'FeatureCollection',
        'features': features,
    }


@app.get('/api/v1/boundaries/sido', response_model=BoundaryFeatureCollection)
async def read_sido_boundaries() -> dict[str, Any]:
    """React 지도에서 첫 단계로 표시할 전국 시도 경계입니다."""
    return await get_sido_boundaries()
