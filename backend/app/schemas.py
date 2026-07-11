from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
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


class CommentCreate(BaseModel):
    author: str = Field(min_length=1, max_length=40)
    content: str = Field(min_length=1, max_length=1000)


class SummarizeRequest(BaseModel):
    title: str = ""
    content: str
