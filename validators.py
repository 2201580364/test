"""
请求参数校验模块。

提供分页参数校验和用户输入校验，确保参数类型与格式正确。
"""

import re
from typing import Any, Tuple

from errors import ValidationError


def validate_pagination(page: Any, page_size: Any) -> Tuple[int, int]:
    """
    校验分页参数，返回经过验证的 (page, page_size) 整数值。

    处理规则：
    - page 必须是正整数，默认为 1
    - page_size 必须是正整数，默认为 20，最大不超过 100
    - 若参数无法转换为整数或不满足约束，抛出 ValidationError
    """
    # 处理 page
    if page is None or page == '':
        page = 1
    else:
        try:
            page = int(page)
        except (ValueError, TypeError):
            raise ValidationError("page must be a positive integer")
        if page < 1:
            raise ValidationError("page must be a positive integer")

    # 处理 page_size
    if page_size is None or page_size == '':
        page_size = 20
    else:
        try:
            page_size = int(page_size)
        except (ValueError, TypeError):
            raise ValidationError("page_size must be a positive integer")
        if page_size < 1:
            raise ValidationError("page_size must be a positive integer")
        if page_size > 100:
            raise ValidationError("page_size must not exceed 100")

    return page, page_size


def validate_user_input(data: dict) -> dict:
    """
    校验创建用户所需的请求体，返回清理后的数据。

    要求：
    - 必须提供 name 字段，且为非空字符串（去除首尾空格后）
    - 必须提供 email 字段，且符合基本邮箱格式
    - 若校验失败，抛出 ValidationError
    """
    # 显式类型检查，防止非 dict 类型导致意外异常
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")

    errors = []

    # 校验 name
    if 'name' not in data:
        errors.append("name is required")
    else:
        name = data['name']
        if not isinstance(name, str):
            errors.append("name must be a string")
        else:
            name = name.strip()
            if not name:
                errors.append("name cannot be empty")
            else:
                data['name'] = name  # 保存清理后的值

    # 校验 email
    if 'email' not in data:
        errors.append("email is required")
    else:
        email = data['email']
        if not isinstance(email, str):
            errors.append("email must be a string")
        else:
            email = email.strip().lower()
            # 基本邮箱格式校验
            if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
                errors.append("email format is invalid")
            else:
                data['email'] = email  # 保存清理后的值

    if errors:
        raise ValidationError("; ".join(errors))

    # 只返回需要的字段
    return {
        'name': data['name'],
        'email': data['email']
    }
