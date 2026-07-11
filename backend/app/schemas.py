from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class CategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    categoryId: str
    summary: str = ""
    thumbnailUrl: str = ""
    content: str = ""


class PostUpdate(PostCreate):
    pass


class SummarizeRequest(BaseModel):
    title: str = ""
    content: str
